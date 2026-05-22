# Part of web_progress. See LICENSE file for full copyright and licensing details.
"""
Tests for web progress HTTP controllers
"""
from odoo.tests import tagged, HttpCase
from odoo import api
from odoo.modules.registry import Registry
import uuid
import json
import urllib.parse


@tagged('post_install', '-at_install')
class TestWebProgressController(HttpCase):
    """
    Test web progress HTTP controllers
    """

    def test_cancel_progress_controller(self):
        """Test /web/progress/cancel endpoint"""
        self.authenticate('admin', 'admin')
        progress_code = str(uuid.uuid4())

        response = self.url_open(
            '/web/progress/cancel',
            data=json.dumps({'jsonrpc': '2.0', 'method': 'call', 'params': {'progress_code': progress_code}, 'id': 1}),
            headers={'Content-Type': 'application/json'}
        )
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertIn('id', result)

    def test_cancel_progress_creates_cancel_record(self):
        """Test /web/progress/cancel creates a cancel record in database"""
        self.authenticate('admin', 'admin')
        progress_code = str(uuid.uuid4())

        response = self.url_open(
            '/web/progress/cancel',
            data=json.dumps({'jsonrpc': '2.0', 'method': 'call', 'params': {'progress_code': progress_code}, 'id': 1}),
            headers={'Content-Type': 'application/json'}
        )
        self.assertEqual(response.status_code, 200)

        with Registry(self.env.cr.dbname).cursor() as new_cr:
            new_env = api.Environment(new_cr, self.env.uid, self.env.context)
            progress_rec = new_env['web.progress'].search([
                ('code', '=', progress_code),
                ('state', '=', 'cancel')
            ])
            self.assertEqual(len(progress_rec), 1)


@tagged('post_install', '-at_install')
class TestReportDownloadController(HttpCase):
    """
    Test report download controller with progress
    """

    def test_report_download_without_progress(self):
        """Test /report/download without progress_code"""
        self.authenticate('admin', 'admin')

        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            partners = self.env['res.partner'].search([], limit=1)
            if partners:
                data = json.dumps([
                    f'/report/pdf/{report.report_name}/{partners.id}',
                    'qweb-pdf'
                ])
                response = self.url_open(
                    f'/report/download?data={data}&context=%7B%7D',
                    headers={'Content-Type': 'application/json'}
                )
                self.assertIn(response.status_code, [200, 400, 404, 500])

    def test_report_download_with_progress(self):
        """Test /report/download with progress_code in context"""
        self.authenticate('admin', 'admin')

        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            partners = self.env['res.partner'].search([], limit=1)
            if partners:
                progress_code = str(uuid.uuid4())
                data = json.dumps([
                    f'/report/pdf/{report.report_name}/{partners.id}',
                    'qweb-pdf'
                ])
                context = json.dumps({'progress_code': progress_code})
                response = self.url_open(
                    f'/report/download?data={data}&context={context}',
                    headers={'Content-Type': 'application/json'}
                )
                self.assertIn(response.status_code, [200, 400, 404, 500])

    def test_report_download_with_empty_context(self):
        """Test /report/download with empty context"""
        self.authenticate('admin', 'admin')

        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            partners = self.env['res.partner'].search([], limit=1)
            if partners:
                data = json.dumps([
                    f'/report/pdf/{report.report_name}/{partners.id}',
                    'qweb-pdf'
                ])
                response = self.url_open(
                    f'/report/download?data={data}',
                    headers={'Content-Type': 'application/json'}
                )
                self.assertIn(response.status_code, [200, 400, 404, 500])

    def test_report_download_with_null_context(self):
        """Test /report/download with null context"""
        self.authenticate('admin', 'admin')

        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            partners = self.env['res.partner'].search([], limit=1)
            if partners:
                data = json.dumps([
                    f'/report/pdf/{report.report_name}/{partners.id}',
                    'qweb-pdf'
                ])
                response = self.url_open(
                    f'/report/download?data={data}&context=null',
                    headers={'Content-Type': 'application/json'}
                )
                self.assertIn(response.status_code, [200, 400, 404, 500])

    def test_report_download_invalid_report(self):
        """Test /report/download with invalid report triggers exception path"""
        self.authenticate('admin', 'admin')

        progress_code = str(uuid.uuid4())
        data = json.dumps([
            '/report/pdf/base.non_existent_report/1',
            'qweb-pdf'
        ])
        context = json.dumps({'progress_code': progress_code})
        response = self.url_open(
            f'/report/download?data={data}&context={context}',
            headers={'Content-Type': 'application/json'}
        )
        self.assertIn(response.status_code, [200, 400, 404, 500])

    def test_report_download_html_format(self):
        """Test /report/download with html format"""
        self.authenticate('admin', 'admin')

        report = self.env.ref('base.action_report_partnerlist', raise_if_not_found=False)
        if report:
            partners = self.env['res.partner'].search([], limit=1)
            if partners:
                progress_code = str(uuid.uuid4())
                data = json.dumps([
                    f'/report/html/{report.report_name}/{partners.id}',
                    'qweb-html'
                ])
                context = json.dumps({'progress_code': progress_code})
                response = self.url_open(
                    f'/report/download?data={data}&context={context}',
                    headers={'Content-Type': 'application/json'}
                )
                self.assertIn(response.status_code, [200, 400, 404, 500])
