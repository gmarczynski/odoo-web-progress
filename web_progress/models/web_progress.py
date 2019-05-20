from odoo import models, api, registry, fields, _, SUPERUSER_ID
from odoo.exceptions import UserError
from multiprocessing import RLock
from datetime import datetime, timedelta
import threading
import logging

_logger = logging.getLogger(__name__)
lock = RLock()


class WebProgress(models.TransientModel):
    _name = 'web.progress'
    _description = "Operation Progress"
    _transient_max_hours = 0.5
    # store recursion depth for every operation
    _recur_depths = {}
    # track time between progress reports
    _last_progress = {}
    # min time between progress reports (in seconds)
    _progress_period_min_secs = 0
    # max time between progress reports (in seconds)
    _progress_period_max_secs = 10
    assert _progress_period_min_secs <= _progress_period_max_secs

    name = fields.Char("Message")
    code = fields.Char("Code", required=True, index=True)
    recur_depth = fields.Integer("Recursion depth", index=True, default=0)
    progress = fields.Integer("Progress")
    done = fields.Integer("Done")
    total = fields.Integer("Total")
    state = fields.Selection([('ongoing', "Ongoing"),
                              ('done', "Done"),
                              ('cancel', "Cancelled"),
                              ], "State")
    cancellable = fields.Boolean("Cancellable")
    user_id = fields.Many2one('res.users', "User")

    #
    # Called by web client
    #

    @api.model
    def cancel_progress(self, code=None):
        """
        Register cancelled operation
        :param code: web progress code
        """
        vals = {
            'code': code,
            'state': 'cancel',
            'user_id': self.env.user.id,
        }
        _logger.info('Cancelling progress {}'.format(code))
        self._create_progress(vals)

    @api.model
    def get_progress(self, code=None, recur_depth=None):
        """
        Get progress for given code
        :param code: web progress code
        :param recur_depth: recursion depth
        """
        result = []
        domain = []
        if recur_depth is not None:
            domain.append(('recur_depth', '=', recur_depth))
        if code:
            domain.append(('code', '=', code))
        if domain:
            progress_id = self.search(domain, order='create_date desc', limit=1)
        else:
            progress_id = self.env[self._name]
        # check progress of parent operations
        if recur_depth is None and progress_id.recur_depth:
            for parent_depth in range(progress_id.recur_depth):
                result += self.get_progress(code, recur_depth=parent_depth)
        progress_vals = {
            'msg': progress_id.name,
            'code': progress_id.code,
            'progress': progress_id.progress,
            'done': progress_id.done,
            'total': progress_id.total,
            'state': progress_id.state,
            'cancellable': progress_id.cancellable,
            'uid': progress_id.user_id.id,
        }
        # register this operation progress
        result.append(progress_vals)

        return result

    @api.model
    def get_all_progress(self):
        """
        Get progress information for all ongoing operations
        """
        query = """
        SELECT DISTINCT
        FIRST_VALUE(CASE WHEN state = 'ongoing' AND done != total THEN id END) 
            OVER (PARTITION BY code ORDER BY create_date DESC) AS id
        FROM web_progress
        WHERE recur_depth = 0 {user_id}
        """.format(user_id=self.env.user.id != SUPERUSER_ID and "AND user_id = {}".format(self.env.user.id) or '')
        # superuser has right to see (and cancel) progress of everybody
        # _logger.info(query)
        self.env.cr.execute(query)
        result = self.env.cr.fetchall()
        progress_ids = self.browse([r[0] for r in result if r[0]]).sorted('code')
        # compute real progress when there are recursive progress calls
        progress_real = {}
        for progress_id in progress_ids:
            progress = 0
            progress_total = 100
            deep_progress_list = progress_id.get_progress(progress_id.code)
            if len(deep_progress_list) <= 1:
                progress = progress_id.progress
            else:
                for el in deep_progress_list:
                    if el['progress'] and el['total']:
                        progress += el['progress'] * progress_total / 100
                    if el['total']:
                        progress_total /= el['total']
            progress_real[progress_id.code] = round(progress, 0)
        return [{'msg': progress_id.name,
                 'code': progress_id.code,
                 'progress': progress_real[progress_id.code],
                 'done': progress_id.done,
                 'total': progress_id.total,
                 'state': progress_id.state,
                 'cancellable': progress_id.cancellable,
                 'uid': progress_id.user_id,
                 } for progress_id in progress_ids]

    #
    # Protected members called by backend
    # Do not call them directly
    #

    @api.model
    def _report_progress(self, data, msg='', total=None, cancellable=True, log_level="info"):
        """
        Progress reporting generator
        :param data: collection / generator to iterate onto
        :param msg: msg to mass in progress report
        :param total: provide total directly to avoid calling len on data (which fails on generators)
        :param cancellable: indicates whether the operation is cancellable
        :param log_level: log level to use when logging progress
        :return: yields every element of iteration
        """
        if total is None:
            total = len(data)
        if total <= 1:
            # skip report progress if there is zero or 1 element in data
            for rec in data:
                yield rec
            return

        # web progress_code typically comes from web client in call context
        code = self.env.context.get('progress_code')
        with lock:
            recur_depth = self._get_recur_depth(code)
            if recur_depth:
                self._recur_depths[code] += 1
            else:
                self._recur_depths[code] = 1

        try:
            for num, rec in zip(range(total), data):
                self._report_progress_do_percent(code, num, total, msg, recur_depth, cancellable, log_level)
                yield rec
        finally:
            # finally record progress as finished
            self._report_progress_done(code, total, msg, recur_depth, cancellable, log_level)
            with lock:
                self._recur_depths[code] -= 1
                if not self._recur_depths[code]:
                    del self._recur_depths[code]

    @api.model
    def _get_recur_depth(self, code):
        """
        Get current recursion depth
        :param code: web progress code
        :return: current recursion depth
        """
        with lock:
            recur_depth = self._recur_depths.get(code, 0)
        return recur_depth

    @api.model
    def _create_progress(self, vals):
        """
        Create a web progress record
        Creation uses a fresh cursor, i.e. outside the current transaction scope
        :param vals: creation vals
        :return: None
        """
        with api.Environment.manage():
            with registry(self.env.cr.dbname).cursor() as new_cr:
                # Create a new environment with new cursor database
                new_env = api.Environment(new_cr, self.env.uid, self.env.context)
                # with_env replace original env for this method
                progress_obj = self.with_env(new_env)
                progress_obj.create(vals)  # isolated transaction to commit
                new_env.cr.commit()

    @api.model
    def _check_cancelled(self, code):
        """
        Check if operation was not cancelled by the user.
        The check is executed using a fresh cursor, i.e., it looks outside the current transaction scope
        :param code: web progress code
        :return: (recordset) res.users of the user that cancelled the operation
        """
        with api.Environment.manage():
            with registry(self.env.cr.dbname).cursor() as new_cr:
                # use new cursor to check for cancel
                query = """
                SELECT user_id FROM web_progress
                WHERE code = %s AND state = 'cancel' AND recur_depth = 0 
                    AND (user_id = %s or user_id = %s)
                """
                new_cr.execute(query, (code, self.env.user.id, SUPERUSER_ID))
                result = new_cr.fetchall()
                if result:
                    return self.user_id.browse(result[0])
        return False

    def _report_progress_do_percent(self, code, num, total, msg, recur_depth, cancellable=True, log_level="debug"):
        """
        Progress reporting function
        At the moment this only logs the progress.
        :param num: how much items processed
        :param total: total of items to process
        :param msg: message for progress report
        :param recur_depth: recursion depth
        :param cancellable: indicates whether the operation is cancellable
        :return: None
        """
        # check the time from last progress report
        precise_code = code + '##' + str(recur_depth)
        last_progress = self._last_progress.get(precise_code,
                                                (datetime.now() - timedelta(seconds=self._progress_period_max_secs)))
        time_now = datetime.now()
        period_sec = (time_now - last_progress).total_seconds()
        # respect min report progress time
        if period_sec < self._progress_period_min_secs:
            return
        # report progress after max period and on every step
        # the first progress 0 will always be reported
        if period_sec >= self._progress_period_max_secs:
            user_id = self._check_cancelled(code)
            if cancellable and user_id:
                raise UserError(_("Operation has been cancelled by") + " " + user_id.name)
            percent = round(100 * num / total, 2)
            self._report_progress_store(code, percent, num, total, msg,
                                        recur_depth=recur_depth, cancellable=cancellable, log_level=log_level)
            self._last_progress[precise_code] = time_now

    def _report_progress_done(self, code, total, msg, recur_depth=0, cancellable=True, log_level="debug"):
        """
        Report progress as done.
        :param code: progress operation code
        :param total: total units
        :param msg: logging message
        :param recur_depth: recursion depth
        :param cancellable: indicates whether the operation is cancellable
        :return:
        """
        return self._report_progress_store(code, 100, total, total, msg, 'done', recur_depth, cancellable, log_level)

    def _report_progress_store(self, code, percent, num, total, msg, state='ongoing',
                               recur_depth=0, cancellable=True, log_level="debug"):
        """
        Progress storing function. Stores progress in log and in db.
        :param code: progress operation code
        :param percent: done percent
        :param num: done units
        :param total: total units
        :param msg: logging message
        :param recur_depth: recursion depth
        :param cancellable: indicates whether the operation is cancellable
        :param state: state of progress: ongoing or done
        """
        log_message = "Progress %s%% (%s/%s)%s" % (percent, num, total, msg and (' %s.' % msg) or '')
        if hasattr(_logger, log_level):
            logger_cmd = getattr(_logger, log_level)
        else:
            logger_cmd = _logger.info
        logger_cmd((">" * (recur_depth + 1)) + " " + log_message)
        vals = {
            'name': msg,
            'code': code,
            'recur_depth': recur_depth,
            'progress': percent,
            'done': num,
            'total': total,
            'state': state,
            'cancellable': cancellable,
            'user_id': self.env.user.id,
        }
        self._create_progress(vals)

