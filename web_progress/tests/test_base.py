# Part of web_progress. See LICENSE file for full copyright and licensing details.
"""
Tests for base model extensions (GeneratorWithLenIndexable, progress iteration)
"""
from odoo.tests import common, tagged
from odoo import api
from odoo.modules.registry import Registry
import uuid

from ..models.base import GeneratorWithLenIndexable, MIN_PROGRESS_ITER
from .common import cleanup_global_progress_state


@tagged('at_install', '-post_install')
class TestGeneratorWithLenIndexable(common.TransactionCase):
    """
    Test the GeneratorWithLenIndexable wrapper class
    """

    def setUp(self):
        super(TestGeneratorWithLenIndexable, self).setUp()
        cleanup_global_progress_state()

    def test_len(self):
        """Test __len__ returns correct length"""
        data = [1, 2, 3, 4, 5]
        gen = iter(data)
        wrapper = GeneratorWithLenIndexable(gen, len(data), data)
        self.assertEqual(len(wrapper), 5)

    def test_iter(self):
        """Test __iter__ iterates correctly"""
        data = [1, 2, 3, 4, 5]
        gen = iter(data)
        wrapper = GeneratorWithLenIndexable(gen, len(data), data)
        result = list(wrapper)
        self.assertEqual(result, data)

    def test_getitem(self):
        """Test __getitem__ returns correct item"""
        data = ['a', 'b', 'c', 'd']
        gen = iter(data)
        wrapper = GeneratorWithLenIndexable(gen, len(data), data)
        self.assertEqual(wrapper[0], 'a')
        self.assertEqual(wrapper[2], 'c')
        self.assertEqual(wrapper[-1], 'd')

    def test_getitem_slice(self):
        """Test __getitem__ with slices"""
        data = [1, 2, 3, 4, 5]
        gen = iter(data)
        wrapper = GeneratorWithLenIndexable(gen, len(data), data)
        self.assertEqual(wrapper[1:3], [2, 3])

    def test_getattr(self):
        """Test __getattr__ delegates to data"""
        data = self.env['res.partner'].search([], limit=3)
        gen = iter(data)
        wrapper = GeneratorWithLenIndexable(gen, len(data), data)
        self.assertEqual(wrapper._name, 'res.partner')
        self.assertEqual(wrapper.ids, data.ids)


@tagged('at_install', '-post_install')
class TestWebProgressIterContext(common.TransactionCase):
    """
    Test progress iteration with progress_iter context flag
    """

    def setUp(self):
        super(TestWebProgressIterContext, self).setUp()
        self.partner_obj = self.env['res.partner']
        cleanup_global_progress_state()

    def _get_progress_record_count(self, progress_code):
        """Helper to count progress records for a given code using a new cursor"""
        with Registry(self.env.cr.dbname).cursor() as new_cr:
            new_env = api.Environment(new_cr, self.env.uid, self.env.context)
            return new_env['web.progress'].search_count([('code', '=', progress_code)])

    def test_iter_with_progress_iter_context_small_recordset(self):
        """Test that small recordsets don't trigger auto-progress and don't create progress records"""
        # Ensure we have a small recordset (less than MIN_PROGRESS_ITER)
        partners = self.partner_obj.search([], limit=MIN_PROGRESS_ITER - 1)
        if len(partners) < MIN_PROGRESS_ITER:
            progress_code = str(uuid.uuid4())
            partners = partners.with_context(progress_code=progress_code, progress_iter=True)

            # Iterate through the recordset
            count = 0
            for _partner in partners:
                count += 1

            self.assertEqual(count, len(partners))

            # Verify NO progress records were created for small recordsets
            progress_count = self._get_progress_record_count(progress_code)
            self.assertEqual(progress_count, 0,
                             f"No progress records should be created for recordsets smaller than {MIN_PROGRESS_ITER}")

    def test_iter_with_progress_iter_context_large_recordset(self):
        """Test that large recordsets trigger auto-progress and create progress records"""
        # Create enough partners to exceed MIN_PROGRESS_ITER
        for i in range(MIN_PROGRESS_ITER + 5):
            self.partner_obj.create({'name': f'Test Partner Iter {i}'})

        partners = self.partner_obj.search([], limit=MIN_PROGRESS_ITER + 2)
        self.assertGreater(len(partners), MIN_PROGRESS_ITER,
                          f"Test requires more than {MIN_PROGRESS_ITER} partners")

        progress_code = str(uuid.uuid4())
        partners = partners.with_context(progress_code=progress_code, progress_iter=True)

        # Iterate through the recordset
        count = 0
        for _partner in partners:
            count += 1

        self.assertEqual(count, len(partners))

        # Verify progress records WERE created for large recordsets
        progress_count = self._get_progress_record_count(progress_code)
        self.assertGreater(progress_count, 0,
                          f"Progress records should be created for recordsets larger than {MIN_PROGRESS_ITER}")

    def test_iter_without_progress_iter_context(self):
        """Test normal iteration without progress_iter doesn't create progress records"""
        progress_code = str(uuid.uuid4())
        # Note: progress_iter is NOT set, only progress_code
        partners = self.partner_obj.with_context(progress_code=progress_code).search([], limit=10)

        count = 0
        for _partner in partners:
            count += 1

        self.assertEqual(count, len(partners))

        # Verify no progress records were created without progress_iter flag
        progress_count = self._get_progress_record_count(progress_code)
        self.assertEqual(progress_count, 0,
                        "No progress records should be created without progress_iter=True")


@tagged('at_install', '-post_install')
class TestBaseExtractRecords(common.TransactionCase):
    """
    Test base _extract_records method with progress
    """

    def setUp(self):
        super(TestBaseExtractRecords, self).setUp()
        self.partner_obj = self.env['res.partner']
        cleanup_global_progress_state()

    def test_extract_records_without_progress(self):
        """Test _extract_records without progress_code"""
        fields_ = [{'name': 'name', 'type': 'char'}]
        data = [['Test Partner 1'], ['Test Partner 2']]
        result = self.partner_obj._extract_records(fields_, data)
        self.assertTrue(hasattr(result, '__iter__'))

    def test_extract_records_with_progress(self):
        """Test _extract_records with progress_code wraps in progress iter"""
        progress_code = str(uuid.uuid4())
        partner = self.partner_obj.with_context(progress_code=progress_code)
        fields_ = [{'name': 'name', 'type': 'char'}]
        data = [['Test Partner 1'], ['Test Partner 2']]
        result = partner._extract_records(fields_, data)
        self.assertTrue(hasattr(result, '__iter__'))


@tagged('at_install', '-post_install')
class TestBaseExportRows(common.TransactionCase):
    """
    Test base _export_rows method with progress
    """

    def setUp(self):
        super(TestBaseExportRows, self).setUp()
        self.partner_obj = self.env['res.partner']
        cleanup_global_progress_state()

    def test_export_rows_without_progress(self):
        """Test _export_rows without progress_code"""
        partners = self.partner_obj.search([], limit=5)
        if partners:
            result = partners._export_rows([['name']])
            self.assertIsInstance(result, list)

    def test_export_rows_with_progress(self):
        """Test _export_rows with progress_code uses batching"""
        progress_code = str(uuid.uuid4())

        for i in range(5):
            self.partner_obj.create({'name': f'Export Test Partner {i}'})

        partners = self.partner_obj.with_context(progress_code=progress_code).search([], limit=5)
        if partners:
            result = partners._export_rows([['name']])
            self.assertIsInstance(result, list)
