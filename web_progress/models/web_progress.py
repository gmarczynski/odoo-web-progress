from odoo import models, api, registry, fields, _
from multiprocessing import RLock
import logging

_logger = logging.getLogger(__name__)
lock = RLock()

class WebProgress(models.TransientModel):
    _name = 'web.progress'
    _description = "Operation Progress"
    _transient_max_hours = 0.5

    name = fields.Char("Message")
    code = fields.Char("Code", required=True)
    recur_depth = fields.Integer("Recursion depth")
    progress = fields.Integer("Progress")
    done = fields.Integer("Done")
    total = fields.Integer("Total")
    state = fields.Selection([('ongoing', "Ongoing"),
                              ('done', "Done"),
                              ('cancel', "Cancelled"),
                              ], "State")
    cancellable = fields.Boolean("Cancellable")

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
        }
        self.create(vals)

    @api.model
    def get_progress(self, code=None, recur_depth=None):
        """
        Get progress for given code or model or model and res_ids
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
        if progress_id.recur_depth:
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
        }
        # register this operation progress
        result.append(progress_vals)

        return result

    #
    # Called by backend
    #

    @api.model
    def record_progress(self, vals):
        with api.Environment.manage():
            with registry(self.env.cr.dbname).cursor() as new_cr:
                # Create a new environment with new cursor database
                new_env = api.Environment(new_cr, self.env.uid, self.env.context)
                # with_env replace original env for this method
                progress_obj = self.with_env(new_env).env['web.progress']
                progress_obj.create(vals)  # isolated transaction to commit
                new_env.cr.commit()

    @api.model
    def check_cancelled(self, code):
        """
        Chack if operation was not cancelled by the user.
        The check is executed using a fresh cursor, i.e., it looks outside the current transaction scope
        :param code: web progress code
        :return: (boolean) whether an operation was cancelled
        """
        with api.Environment.manage():
            with registry(self.env.cr.dbname).cursor() as new_cr:
                # Create a new environment with new cursor database
                new_env = api.Environment(new_cr, self.env.uid, self.env.context)
                # with_env replace original env for this method
                progress_obj = self.with_env(new_env)
                cancel = progress_obj.search([('code', '=', code),
                                              ('state', '=', 'cancel'),
                                              ])
                if cancel:
                    return True
