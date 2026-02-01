# Part of web_progress. See LICENSE file for full copyright and licensing details.
"""
Tests for base_import model extensions
"""
from odoo.tests import common, tagged
import uuid

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
            'file': b'name\nTest Import Partner',
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
            'file': b'name\nTest Import Partner With Progress',
        })

        result = import_record.execute_import(
            ['name'],
            ['name'],
            {'quoting': '"', 'separator': ',', 'has_headers': True},
            dryrun=True
        )
        self.assertIsInstance(result, dict)
