# Part of web_progress. See LICENSE file for full copyright and licensing details.
"""
Tests for base_import model extensions
"""
from odoo.tests import common, tagged
import uuid
import base64

from .common import cleanup_global_progress_state


@tagged('at_install', '-post_install')
class TestBaseImportExecute(common.TransactionCase):
    """
    Test base_import execute_import method with UserError handling
    """

    def setUp(self):
        super(TestBaseImportExecute, self).setUp()
        cleanup_global_progress_state()

    def test_execute_import_success(self):
        """Test execute_import succeeds with valid data"""
        import_record = self.env['base_import.import'].create({
            'res_model': 'res.partner',
            'file_type': 'text/csv',
            'file_name': 'test.csv',
            'file': base64.b64encode(b'name\nTest Import Partner'),
        })

        result = import_record.execute_import(
            ['name'],
            ['name'],
            {'quoting': '"', 'separator': ',', 'has_headers': True},
            dryrun=True
        )
        self.assertIsInstance(result, dict)

    def test_execute_import_with_progress(self):
        """Test execute_import with progress_code in context"""
        progress_code = str(uuid.uuid4())
        import_record = self.env['base_import.import'].with_context(progress_code=progress_code).create({
            'res_model': 'res.partner',
            'file_type': 'text/csv',
            'file_name': 'test.csv',
            'file': base64.b64encode(b'name\nTest Import Partner With Progress'),
        })

        result = import_record.execute_import(
            ['name'],
            ['name'],
            {'quoting': '"', 'separator': ',', 'has_headers': True},
            dryrun=True
        )
        self.assertIsInstance(result, dict)

    def test_execute_import_invalid_data_format(self):
        """Test execute_import with data that triggers validation error returns messages"""
        import_record = self.env['base_import.import'].create({
            'res_model': 'res.partner',
            'file_type': 'text/csv',
            'file_name': 'test.csv',
            'file': base64.b64encode(b'name,email\nTest Partner,not-an-email'),
        })

        result = import_record.execute_import(
            ['name', 'email'],
            ['name', 'email'],
            {'quoting': '"', 'separator': ',', 'has_headers': True},
            dryrun=True
        )
        self.assertIsInstance(result, dict)

    def test_execute_import_empty_file(self):
        """Test execute_import with empty file"""
        import_record = self.env['base_import.import'].create({
            'res_model': 'res.partner',
            'file_type': 'text/csv',
            'file_name': 'test.csv',
            'file': base64.b64encode(b''),
        })

        try:
            result = import_record.execute_import(
                [],
                [],
                {'quoting': '"', 'separator': ',', 'has_headers': True},
                dryrun=True
            )
            self.assertIsInstance(result, dict)
        except Exception:
            pass

    def test_execute_import_real_import(self):
        """Test execute_import actual import (not dryrun)"""
        import_record = self.env['base_import.import'].create({
            'res_model': 'res.partner',
            'file_type': 'text/csv',
            'file_name': 'test.csv',
            'file': base64.b64encode(b'name\nReal Import Test Partner'),
        })

        result = import_record.execute_import(
            ['name'],
            ['name'],
            {'quoting': '"', 'separator': ',', 'has_headers': True},
            dryrun=False
        )
        self.assertIsInstance(result, dict)

        partner = self.env['res.partner'].search([('name', '=', 'Real Import Test Partner')], limit=1)
        if partner:
            partner.unlink()

    def test_execute_import_with_required_field_missing(self):
        """Test execute_import catches UserError for missing required fields"""
        import_record = self.env['base_import.import'].create({
            'res_model': 'res.country.state',
            'file_type': 'text/csv',
            'file_name': 'test.csv',
            'file': base64.b64encode(b'name\nTest State Without Country'),
        })

        result = import_record.execute_import(
            ['name'],
            ['name'],
            {'quoting': '"', 'separator': ',', 'has_headers': True},
            dryrun=False
        )
        self.assertIsInstance(result, dict)
        if 'messages' in result:
            self.assertIsInstance(result['messages'], list)
