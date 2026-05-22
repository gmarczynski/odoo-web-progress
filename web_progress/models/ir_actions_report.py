# Part of web_progress. See LICENSE file for full copyright and licensing details.
from odoo import models, api, _


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _render_template(self, template, values=None):
        """
        Add progress_iter to the context in order to track progress of iterations inside report generation method
        """
        if 'progress_code' in self.env.context and values and 'docs' in values:
            new_values = values.copy()
            new_values['docs'] = self.web_progress_iter(values.get('docs'), _("Generating HTML"))
        else:
            new_values = values
        return super(IrActionsReport, self)._render_template(template, values=new_values)

    def _render_qweb_pdf_prepare_streams(self, report_ref, data, res_ids=None):
        """
        Hook into PDF stream preparation to report progress at key milestones.
        """
        self.web_progress_percent(10, _('Preparing report'))
        self = self.with_context(progress_iter=True)
        return super(IrActionsReport, self)._render_qweb_pdf_prepare_streams(report_ref, data, res_ids=res_ids)

    def _render_qweb_html(self, report_ref, docids, data=None):
        """
        Report progress when HTML rendering starts
        """
        self.web_progress_percent(20, _('Rendering HTML'))
        return super(IrActionsReport, self)._render_qweb_html(report_ref, docids, data=data)

    def _prepare_html(self, html, report_model=False):
        """
        Report progress when HTML is being parsed and prepared for wkhtmltopdf
        """
        self.web_progress_percent(40, _('Preparing HTML'))
        return super(IrActionsReport, self)._prepare_html(html, report_model=report_model)

    @api.model
    def _run_wkhtmltopdf(self, bodies, report_ref=False, header=None, footer=None,
                         landscape=False, specific_paperformat_args=None, set_viewport_size=False):
        """
        Report progress before and after wkhtmltopdf execution.
        Note: wkhtmltopdf is an external subprocess, so we cannot track real-time progress.
        """
        self.web_progress_percent(50, _('Converting to PDF'))
        result = super(IrActionsReport, self)._run_wkhtmltopdf(
            bodies, report_ref=report_ref, header=header, footer=footer,
            landscape=landscape, specific_paperformat_args=specific_paperformat_args,
            set_viewport_size=set_viewport_size)
        self.web_progress_percent(85, _('PDF generated'))
        return result

    @api.model
    def _merge_pdfs(self, streams, handle_error=None):
        """
        Report progress when merging multiple PDF streams
        """
        self.web_progress_percent(90, _('Merging PDF'))
        return super(IrActionsReport, self)._merge_pdfs(streams, handle_error=handle_error)
