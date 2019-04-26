from odoo import models, api, registry, fields, _
import uuid


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    @api.model
    def render_qweb_html(self, docids, data=None):
        """
        Add progress_iter to the context in order to track progress of iterations inside report generation method
        """
        if 'progress_code' in self._context:
            return super(IrActionsReport, self.with_context(progress_iter=True)).render_qweb_html(docids, data=data)