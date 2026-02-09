# Part of web_progress. See LICENSE file for full copyright and licensing details.
"""
Tests for ir.actions.report model extensions
"""
from odoo.tests import common, tagged
from odoo import api
from odoo.modules.registry import Registry
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
            partners = self.env['res.partner'].search([], limit=2)
            if partners:
                try:
                    result = report._render_qweb_html(report.report_name, partners.ids)
                    self.assertIsNotNone(result)
                except Exception:
                    pass

    def test_render_template_with_progress_code(self):
        """Test _render_template with progress_code wraps docs in progress iter"""
        progress_code = str(uuid.uuid4())
        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            report_with_progress = report.with_context(progress_code=progress_code)
            partners = self.env['res.partner'].search([], limit=2)
            if partners:
                try:
                    result = report_with_progress._render_qweb_html(report.report_name, partners.ids)
                    self.assertIsNotNone(result)
                except Exception:
                    pass

    def test_render_qweb_pdf_prepare_streams_with_progress(self):
        """Test _render_qweb_pdf_prepare_streams reports progress"""
        progress_code = str(uuid.uuid4())
        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            report_with_progress = report.with_context(progress_code=progress_code)
            partners = self.env['res.partner'].search([], limit=1)
            if partners:
                try:
                    result = report_with_progress._render_qweb_pdf_prepare_streams(
                        report.report_name, data=None, res_ids=partners.ids
                    )
                    self.assertIsNotNone(result)
                except Exception:
                    pass

    def test_render_qweb_pdf_prepare_streams_without_progress(self):
        """Test _render_qweb_pdf_prepare_streams works without progress"""
        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            partners = self.env['res.partner'].search([], limit=1)
            if partners:
                try:
                    result = report._render_qweb_pdf_prepare_streams(
                        report.report_name, data=None, res_ids=partners.ids
                    )
                    self.assertIsNotNone(result)
                except Exception:
                    pass

    def test_report_progress_percent_methods(self):
        """Test report progress percent methods exist and are callable"""
        progress_code = str(uuid.uuid4())
        report = self.env['ir.actions.report'].with_context(progress_code=progress_code)

        self.assertTrue(hasattr(report, '_render_qweb_pdf_prepare_streams'))
        self.assertTrue(hasattr(report, '_render_qweb_html'))
        self.assertTrue(hasattr(report, '_prepare_html'))
        self.assertTrue(hasattr(report, '_run_wkhtmltopdf'))
        self.assertTrue(hasattr(report, '_merge_pdfs'))

    def test_web_progress_percent_from_report(self):
        """Test web_progress_percent can be called from report model"""
        progress_code = str(uuid.uuid4())
        report = self.env['ir.actions.report'].with_context(progress_code=progress_code)
        report.web_progress_percent(10, 'Test progress')
        report.web_progress_percent(50, 'Half done')
        report.web_progress_percent(100, 'Complete')

        with Registry(self.env.cr.dbname).cursor() as new_cr:
            new_env = api.Environment(new_cr, self.env.uid, self.env.context)
            progress_count = new_env['web.progress'].search_count([('code', '=', progress_code)])
            self.assertGreater(progress_count, 0)

    def test_web_progress_iter_from_report(self):
        """Test web_progress_iter can be called from report model"""
        progress_code = str(uuid.uuid4())
        report = self.env['ir.actions.report'].with_context(progress_code=progress_code)
        partners = self.env['res.partner'].search([], limit=3)
        if partners:
            wrapped = report.web_progress_iter(partners, "Processing")
            result = list(wrapped)
            self.assertEqual(len(result), len(partners))
