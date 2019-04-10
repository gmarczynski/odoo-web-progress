from odoo import models, api, registry, fields, _
from odoo.exceptions import UserError
import threading
from multiprocessing import RLock
import logging

_logger = logging.getLogger(__name__)
lock = RLock()


class Base(models.AbstractModel):
    _inherit = 'base'
    # store recursion depth for every operation
    _recur_depths = {}

    #
    # Progress reporting
    #

    @api.multi
    def report_progress_iter(self, data, msg='', total=None, cancellable=True, log_level="info"):
        """
        Progress reporting generator
        :param data: collection / generator to iterate onto
        :param msg: msg to mass in progress report
        :param total: provide total directly to avoid calling len on data (which fails on generators)
        :param cancellable: indicates whether the operation is cancellable
        :return: yields every element of iteration
        """
        thread_id = threading.get_ident()
        # web progress_code typically comes from web client in call context
        code = self.env.context.get('progress_code') or str(thread_id)
        with lock:
            recur_depth = self._recur_depths.get(code, 0)
            if recur_depth:
                self._recur_depths[code] += 1
            else:
                self._recur_depths[code] = 1

        if total is None:
            total = len(data)
        try:
            for num, rec in zip(range(total), data):
                self._report_progress_do_percent(code, num, total, msg, recur_depth, cancellable, log_level)
                yield rec
        finally:
            # finally record progress as finished
            self._report_progress_store(code, 100, total, total, msg, 'done', recur_depth, cancellable, log_level)
            with lock:
                self._recur_depths[code] -= 1
                if not self._recur_depths[code]:
                    del self._recur_depths[code]

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
        if total <= 0:
            return
        if total <= 200:
            # if less than 200 elements, report every 10%
            step = 10
        else:
            # otherwise report every 1%
            step = 1
        one_per = int(total/(100/step)) or 1
        if 1 == one_per or 0 == (num % one_per):
            if cancellable and self._report_progress_check_progress_cancelled(code):
                raise UserError(_("Operation has been cancelled by the user."))
            percent = int(100 * num / total) + (num and 1 or 0)
            self._report_progress_store(code, percent, num, total, msg,
                                        recur_depth=recur_depth, cancellable=cancellable, log_level=log_level)
    
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
        logger_cmd((">" * recur_depth) + " " + log_message)
        vals = {
            'name' : msg,
            'code' : code,
            'recur_depth' : recur_depth,
            'progress' : percent,
            'done' : num,
            'total' : total,
            'state' : state,
            'cancellable' : cancellable,
        }
        self.env['web.progress'].record_progress(vals)

    def _report_progress_check_progress_cancelled(self, code):
        """
        Chack if operation was not cancelled by the user.
        The check is executed using a fresh cursor, i.e., it looks outside the current transaction scope
        :param code: web progress code
        :return: (boolean) whether an operation was cancelled
        """
        return  self.env['web.progress'].check_cancelled(code)

    #
    # Add progress reporting to common time-consuming collections
    #

    @api.model
    def _extract_records(self, fields_, data, log=lambda a: None):
        """
        Add progress reporting to collection used in bas_import.import
        It adds progress reporting to all standard imports and additionally makes them cancellable
        """
        total = len(data)
        extracted = super(Base, self)._extract_records(fields_, data, log=log)
        return self.report_progress_iter(extracted, _("importing to {}").
                                         format(self._description.lower()), total=total, cancellable=True,
                                         log_level="debug")