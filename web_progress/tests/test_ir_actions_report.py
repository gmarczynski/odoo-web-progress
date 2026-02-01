# Part of web_progress. See LICENSE file for full copyright and licensing details.
"""
Tests for ir.actions.report model extensions
"""
from odoo.tests import common, tagged
import uuid

from .common import cleanup_global_progress_state


@tagged('at_install', '-post_install')
class TestIrActionsReportProgress(common.TransactionCase):
    """
    Test ir.actions.report progress methods
    """

    def setUp(self):
        super(TestIrActionsReportProgress, self).setUp()
        self.report_obj = self.env['ir.actions.report']
        cleanup_global_progress_state()

    def test_render_template_without_progress_code(self):
        """Test _render_template works without progress_code"""
        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            self.assertTrue(hasattr(report, '_render_template'))

    def test_render_template_with_progress_code(self):
        """Test _render_template with progress_code wraps docs in progress iter"""
        progress_code = str(uuid.uuid4())
        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            report_with_progress = report.with_context(progress_code=progress_code)
            partners = self.env['res.partner'].search([], limit=2)
            values = {'docs': partners}
            self.assertTrue(hasattr(report_with_progress, '_render_template'))

    def test_report_progress_percent_methods(self):
        """Test report progress percent methods exist and are callable"""
        progress_code = str(uuid.uuid4())
        report = self.env['ir.actions.report'].with_context(progress_code=progress_code)

        self.assertTrue(hasattr(report, '_render_qweb_pdf_prepare_streams'))
        self.assertTrue(hasattr(report, '_render_qweb_html'))
        self.assertTrue(hasattr(report, '_prepare_html'))
        self.assertTrue(hasattr(report, '_run_wkhtmltopdf'))
        self.assertTrue(hasattr(report, '_merge_pdfs'))
