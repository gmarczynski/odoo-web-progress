# Part of web_progress. See LICENSE file for full copyright and licensing details.
"""
Unit tests for web.progress model methods
"""
from odoo.tests import common, tagged
from odoo import exceptions, api
from odoo.modules.registry import Registry
import uuid

from ..models.web_progress import CancelledProgress, user_name, recur_depths, progress_data
from .common import cleanup_global_progress_state


@tagged('at_install', '-post_install')
class TestWebProgressUtilityMethods(common.TransactionCase):
    """
    Test utility methods of web.progress model
    """

    def setUp(self):
        super(TestWebProgressUtilityMethods, self).setUp()
        self.web_progress_obj = self.env['web.progress']
        cleanup_global_progress_state()

    def test_format_time_seconds(self):
        """Test _format_time with various second values"""
        self.assertEqual(self.web_progress_obj._format_time(0), "0:00:00")
        self.assertEqual(self.web_progress_obj._format_time(45), "0:00:45")
        self.assertEqual(self.web_progress_obj._format_time(125), "0:02:05")
        self.assertEqual(self.web_progress_obj._format_time(3661), "1:01:01")
        self.assertEqual(self.web_progress_obj._format_time(36000), "10:00:00")

    def test_get_precise_code(self):
        """Test _get_precise_code generates correct precise code"""
        params = {'code': 'test-code-123', 'recur_depth': 0}
        self.assertEqual(self.web_progress_obj._get_precise_code(params), "test-code-123##0")

        params = {'code': 'test-code-123', 'recur_depth': 3}
        self.assertEqual(self.web_progress_obj._get_precise_code(params), "test-code-123##3")

    def test_get_parent_codes(self):
        """Test _get_parent_codes returns all parent codes"""
        params = {'code': 'test-code', 'recur_depth': 0}
        self.assertEqual(self.web_progress_obj._get_parent_codes(params), [])

        params = {'code': 'test-code', 'recur_depth': 1}
        self.assertEqual(self.web_progress_obj._get_parent_codes(params), ['test-code##0'])

        params = {'code': 'test-code', 'recur_depth': 3}
        self.assertEqual(self.web_progress_obj._get_parent_codes(params), ['test-code##0', 'test-code##1', 'test-code##2'])

    def test_is_progress_admin_regular_user(self):
        """Test is_progress_admin returns False for regular users"""
        public_user = self.env.ref('base.public_user', raise_if_not_found=False)
        if public_user:
            result = self.web_progress_obj.is_progress_admin(public_user)
            self.assertFalse(result)
        else:
            result = self.web_progress_obj.is_progress_admin(self.env.user)
            self.assertIsInstance(result, bool)

    def test_is_progress_admin_system_user(self):
        """Test is_progress_admin returns True for system users"""
        admin_user = self.env.ref('base.user_admin')
        result = self.web_progress_obj.is_progress_admin(admin_user)
        self.assertTrue(result)

    def test_is_progress_admin_current_user(self):
        """Test is_progress_admin without user parameter uses current user"""
        result = self.web_progress_obj.is_progress_admin()
        self.assertTrue(result)

    def test_get_user_name_cached(self):
        """Test get_user_name returns cached user name"""
        progress_code = str(uuid.uuid4())
        user_name[progress_code] = 'Test User'
        try:
            result = self.web_progress_obj.get_user_name(progress_code)
            self.assertEqual(result, 'Test User')
        finally:
            del user_name[progress_code]

    def test_get_user_name_not_cached(self):
        """Test get_user_name returns empty string when not cached"""
        progress_code = str(uuid.uuid4())
        result = self.web_progress_obj.get_user_name(progress_code)
        self.assertEqual(result, '')

    def test_cancel_progress(self):
        """Test cancel_progress creates a cancel record"""
        progress_code = str(uuid.uuid4())
        self.web_progress_obj.cancel_progress(progress_code)
        with Registry(self.env.cr.dbname).cursor() as new_cr:
            new_env = api.Environment(new_cr, self.env.uid, self.env.context)
            progress_rec = new_env['web.progress'].search([
                ('code', '=', progress_code),
                ('state', '=', 'cancel')
            ])
            self.assertEqual(len(progress_rec), 1)

    def test_get_recur_depth_no_code(self):
        """Test _get_recur_depth returns 0 for unknown code"""
        result = self.web_progress_obj._get_recur_depth('unknown-code')
        self.assertEqual(result, 0)

    def test_get_recur_depth_with_code(self):
        """Test _get_recur_depth returns correct depth"""
        progress_code = str(uuid.uuid4())
        recur_depths[progress_code] = 5
        try:
            result = self.web_progress_obj._get_recur_depth(progress_code)
            self.assertEqual(result, 5)
        finally:
            del recur_depths[progress_code]


@tagged('at_install', '-post_install')
class TestCancelledProgressException(common.TransactionCase):
    """
    Test the CancelledProgress exception
    """

    def setUp(self):
        super(TestCancelledProgressException, self).setUp()
        cleanup_global_progress_state()

    def test_cancelled_progress_is_user_error(self):
        """Test CancelledProgress is a subclass of UserError"""
        self.assertTrue(issubclass(CancelledProgress, exceptions.UserError))

    def test_cancelled_progress_can_be_raised(self):
        """Test CancelledProgress can be raised and caught"""
        with self.assertRaises(CancelledProgress):
            raise CancelledProgress("Operation cancelled")

    def test_cancelled_progress_caught_as_user_error(self):
        """Test CancelledProgress can be caught as UserError"""
        with self.assertRaises(exceptions.UserError):
            raise CancelledProgress("Operation cancelled")


@tagged('at_install', '-post_install')
class TestWebProgressGetProgress(common.TransactionCase):
    """
    Test get_progress method variations
    """

    def setUp(self):
        super(TestWebProgressGetProgress, self).setUp()
        self.web_progress_obj = self.env['web.progress']
        cleanup_global_progress_state()

    def test_get_progress_no_code(self):
        """Test get_progress with no code returns empty progress"""
        result = self.web_progress_obj.get_progress()
        self.assertEqual(len(result), 1)
        self.assertFalse(result[0]['code'])

    def test_get_progress_nonexistent_code(self):
        """Test get_progress with non-existent code"""
        result = self.web_progress_obj.get_progress('nonexistent-code')
        self.assertEqual(len(result), 1)
        self.assertFalse(result[0]['code'])

    def test_get_progress_with_recur_depth(self):
        """Test get_progress with recur_depth parameter"""
        progress_code = str(uuid.uuid4())
        partner_obj = self.env['res.partner'].with_context(progress_code=progress_code)
        partner_obj.web_progress_percent(50, "Test")
        partner_obj.web_progress_percent(100, "Done")

        with Registry(self.env.cr.dbname).cursor() as new_cr:
            new_env = api.Environment(new_cr, self.env.uid, self.env.context)
            progress_obj = self.env['web.progress'].with_env(new_env)
            result = progress_obj.get_progress(progress_code, recur_depth=0)
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]['code'], progress_code)


@tagged('at_install', '-post_install')
class TestWebProgressPercent(common.TransactionCase):
    """
    Extended tests for web_progress_percent
    """

    def setUp(self):
        super(TestWebProgressPercent, self).setUp()
        self.partner_obj = self.env['res.partner']
        cleanup_global_progress_state()

    def test_web_progress_percent_without_code(self):
        """Test web_progress_percent does nothing without progress_code"""
        self.partner_obj.web_progress_percent(50, "Test")

    def test_web_progress_percent_clamps_values(self):
        """Test web_progress_percent clamps values to 0-100 range"""
        progress_code = str(uuid.uuid4())
        partner = self.partner_obj.with_context(progress_code=progress_code)
        partner.web_progress_percent(-10, "Negative")
        partner.web_progress_percent(150, "Over 100")

        with Registry(self.env.cr.dbname).cursor() as new_cr:
            new_env = api.Environment(new_cr, self.env.uid, self.env.context)
            progress_recs = new_env['web.progress'].search([('code', '=', progress_code)])
            for rec in progress_recs:
                self.assertGreaterEqual(rec.progress, 0)
                self.assertLessEqual(rec.progress, 100)

    def test_web_progress_percent_log_levels(self):
        """Test web_progress_percent with different log levels"""
        progress_code = str(uuid.uuid4())
        partner = self.partner_obj.with_context(progress_code=progress_code)
        partner.web_progress_percent(10, "Debug", log_level="debug")
        partner.web_progress_percent(20, "Warning", log_level="warning")
        partner.web_progress_percent(100, "End", log_level="info")

    def test_web_progress_percent_non_cancellable(self):
        """Test web_progress_percent with cancellable=False"""
        progress_code = str(uuid.uuid4())
        partner = self.partner_obj.with_context(progress_code=progress_code)
        partner.web_progress_percent(50, "Non-cancellable", cancellable=False)
        partner.web_progress_percent(100, "Done")


@tagged('at_install', '-post_install')
class TestWebProgressIter(common.TransactionCase):
    """
    Extended tests for web_progress_iter
    """

    def setUp(self):
        super(TestWebProgressIter, self).setUp()
        self.partner_obj = self.env['res.partner']
        cleanup_global_progress_state()

    def test_web_progress_iter_without_code(self):
        """Test web_progress_iter returns data unchanged without progress_code"""
        data = [1, 2, 3, 4, 5]
        result = self.partner_obj.web_progress_iter(data)
        self.assertEqual(result, data)

    def test_web_progress_iter_with_total(self):
        """Test web_progress_iter with explicit total parameter"""
        progress_code = str(uuid.uuid4())
        partner = self.partner_obj.with_context(progress_code=progress_code)
        data = [1, 2, 3]
        wrapped = partner.web_progress_iter(data, msg="Test", total=3)
        result = list(wrapped)
        self.assertEqual(result, data)

    def test_web_progress_iter_generator_without_len(self):
        """Test web_progress_iter with generator that has no len"""
        def my_gen():
            yield 1
            yield 2
            yield 3

        result = self.partner_obj.web_progress_iter(my_gen())
        self.assertEqual(list(result), [1, 2, 3])

    def test_web_progress_iter_generator_with_code_no_total(self):
        """Test web_progress_iter with generator and progress_code but no total"""
        progress_code = str(uuid.uuid4())
        partner = self.partner_obj.with_context(progress_code=progress_code)

        def my_gen():
            yield 1
            yield 2

        result = partner.web_progress_iter(my_gen())
        self.assertEqual(list(result), [1, 2])

    def test_web_progress_iter_generator_with_total(self):
        """Test web_progress_iter with generator and explicit total"""
        progress_code = str(uuid.uuid4())
        partner = self.partner_obj.with_context(progress_code=progress_code)

        def my_gen():
            yield 'a'
            yield 'b'
            yield 'c'

        wrapped = partner.web_progress_iter(my_gen(), total=3)
        result = list(wrapped)
        self.assertEqual(result, ['a', 'b', 'c'])


@tagged('at_install', '-post_install')
class TestWebProgressCancel(common.TransactionCase):
    """
    Test web_progress_cancel method
    """

    def setUp(self):
        super(TestWebProgressCancel, self).setUp()
        self.partner_obj = self.env['res.partner']
        cleanup_global_progress_state()

    def test_web_progress_cancel_with_explicit_code(self):
        """Test web_progress_cancel with explicit code parameter"""
        progress_code = str(uuid.uuid4())
        self.partner_obj.web_progress_cancel(code=progress_code)

        with Registry(self.env.cr.dbname).cursor() as new_cr:
            new_env = api.Environment(new_cr, self.env.uid, self.env.context)
            progress_rec = new_env['web.progress'].search([
                ('code', '=', progress_code),
                ('state', '=', 'cancel')
            ])
            self.assertEqual(len(progress_rec), 1)

    def test_web_progress_cancel_from_context(self):
        """Test web_progress_cancel uses code from context"""
        progress_code = str(uuid.uuid4())
        partner = self.partner_obj.with_context(progress_code=progress_code)
        partner.web_progress_cancel()

        with Registry(self.env.cr.dbname).cursor() as new_cr:
            new_env = api.Environment(new_cr, self.env.uid, self.env.context)
            progress_rec = new_env['web.progress'].search([
                ('code', '=', progress_code),
                ('state', '=', 'cancel')
            ])
            self.assertEqual(len(progress_rec), 1)

    def test_web_progress_cancel_no_code(self):
        """Test web_progress_cancel does nothing without code"""
        self.partner_obj.web_progress_cancel()


@tagged('at_install', '-post_install')
class TestWebProgressReportProgressPrepareVals(common.TransactionCase):
    """
    Test _report_progress_prepare_vals method
    """

    def setUp(self):
        super(TestWebProgressReportProgressPrepareVals, self).setUp()
        self.web_progress_obj = self.env['web.progress']
        cleanup_global_progress_state()

    def test_prepare_vals_filters_fields(self):
        """Test _report_progress_prepare_vals filters out non-field params"""
        params = {
            'code': 'test-code',
            'msg': 'Test message',
            'progress': 50,
            'state': 'ongoing',
            'extra_param': 'should be filtered',
            'log_level': 'info',
            'recur_depth': 0,
        }
        result = self.web_progress_obj._report_progress_prepare_vals(params)

        self.assertIn('code', result)
        self.assertIn('msg', result)
        self.assertIn('progress', result)
        self.assertIn('state', result)
        self.assertIn('recur_depth', result)
        self.assertNotIn('extra_param', result)
        self.assertNotIn('log_level', result)


@tagged('at_install', '-post_install')
class TestWebProgressGetTimeLeft(common.TransactionCase):
    """
    Test _get_time_left method
    """

    def setUp(self):
        super(TestWebProgressGetTimeLeft, self).setUp()
        self.web_progress_obj = self.env['web.progress']
        cleanup_global_progress_state()

    def test_get_time_left_no_first_ts(self):
        """Test _get_time_left with no first timestamp returns empty strings"""
        from datetime import datetime
        params = {'progress_total': 50}
        time_now = datetime.now()
        time_left, time_total, time_elapsed = self.web_progress_obj._get_time_left(params, time_now, None)
        self.assertEqual(time_left, '')
        self.assertEqual(time_total, '')
        self.assertEqual(time_elapsed, '')

    def test_get_time_left_zero_progress(self):
        """Test _get_time_left with zero progress returns empty strings"""
        from datetime import datetime, timedelta
        params = {'progress_total': 0}
        time_now = datetime.now()
        first_ts = time_now - timedelta(seconds=10)
        time_left, time_total, time_elapsed = self.web_progress_obj._get_time_left(params, time_now, first_ts)
        self.assertEqual(time_left, '')
        self.assertEqual(time_total, '')
        self.assertEqual(time_elapsed, '')

    def test_get_time_left_with_progress(self):
        """Test _get_time_left calculates time correctly"""
        from datetime import datetime, timedelta
        params = {'progress_total': 50}
        time_now = datetime.now()
        first_ts = time_now - timedelta(seconds=60)
        time_left, time_total, time_elapsed = self.web_progress_obj._get_time_left(params, time_now, first_ts)
        self.assertEqual(time_left, '0:01:00')
        self.assertEqual(time_total, '0:02:00')
        self.assertEqual(time_elapsed, '0:01:00')


@tagged('at_install', '-post_install')
class TestWebProgressGetProgressTotal(common.TransactionCase):
    """
    Test _get_progress_total method
    """

    def setUp(self):
        super(TestWebProgressGetProgressTotal, self).setUp()
        self.web_progress_obj = self.env['web.progress']
        cleanup_global_progress_state()

    def test_get_progress_total_single_level(self):
        """Test _get_progress_total with single level"""
        progress_code = str(uuid.uuid4())
        params = {'code': progress_code, 'recur_depth': 0, 'done': 5, 'total': 10, 'progress': 50}
        precise_code = self.web_progress_obj._get_precise_code(params)
        progress_data[precise_code] = params

        try:
            result = self.web_progress_obj._get_progress_total(params)
            self.assertEqual(result, 50.0)
        finally:
            del progress_data[precise_code]

    def test_get_progress_total_empty(self):
        """Test _get_progress_total with no data returns 0"""
        progress_code = str(uuid.uuid4())
        params = {'code': progress_code, 'recur_depth': 0}
        result = self.web_progress_obj._get_progress_total(params)
        self.assertEqual(result, 0.0)


@tagged('at_install', '-post_install')
class TestJsonDump(common.TransactionCase):
    """
    Test json_dump utility function
    """

    def setUp(self):
        super(TestJsonDump, self).setUp()
        cleanup_global_progress_state()

    def test_json_dump(self):
        """Test json_dump produces compact JSON"""
        from ..models.web_progress import json_dump
        result = json_dump({'key': 'value', 'number': 123})
        self.assertNotIn(': ', result)
        self.assertNotIn(', ', result)
        self.assertIn('key', result)
        self.assertIn('value', result)


@tagged('at_install', '-post_install')
class TestGetProgressRpc(common.TransactionCase):
    """
    Test get_progress_rpc method
    """

    def setUp(self):
        super(TestGetProgressRpc, self).setUp()
        self.web_progress_obj = self.env['web.progress']
        cleanup_global_progress_state()

    def test_get_progress_rpc(self):
        """Test get_progress_rpc creates new cursor and gets progress"""
        progress_code = str(uuid.uuid4())
        partner_obj = self.env['res.partner'].with_context(progress_code=progress_code)
        partner_obj.web_progress_percent(50, "Test RPC")
        partner_obj.web_progress_percent(100, "Done")

        result = self.web_progress_obj.get_progress_rpc(progress_code)
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)

    def test_get_progress_rpc_no_code(self):
        """Test get_progress_rpc without code"""
        result = self.web_progress_obj.get_progress_rpc()
        self.assertIsInstance(result, list)


@tagged('at_install', '-post_install')
class TestReportProgressSingleton(common.TransactionCase):
    """
    Test _report_progress with singletons and when total is provided via len()
    """

    def setUp(self):
        super(TestReportProgressSingleton, self).setUp()
        self.web_progress_obj = self.env['web.progress']
        cleanup_global_progress_state()

    def test_report_progress_singleton_no_code(self):
        """Test _report_progress with singleton returns elements without progress"""
        data = [1]
        result = list(self.web_progress_obj._report_progress(data, total=1))
        self.assertEqual(result, [1])

    def test_report_progress_singleton_with_code(self):
        """Test _report_progress with singleton and progress code - no progress for singletons"""
        progress_code = str(uuid.uuid4())
        web_progress = self.web_progress_obj.with_context(progress_code=progress_code)
        data = ['single']
        result = list(web_progress._report_progress(data, total=1))
        self.assertEqual(result, ['single'])

    def test_report_progress_total_from_len(self):
        """Test _report_progress computes total from len(data) when not provided"""
        progress_code = str(uuid.uuid4())
        web_progress = self.web_progress_obj.with_context(progress_code=progress_code)
        data = [1, 2, 3, 4, 5]
        result = list(web_progress._report_progress(data))
        self.assertEqual(result, [1, 2, 3, 4, 5])

    def test_report_progress_empty_data(self):
        """Test _report_progress with empty data"""
        progress_code = str(uuid.uuid4())
        web_progress = self.web_progress_obj.with_context(progress_code=progress_code)
        data = []
        result = list(web_progress._report_progress(data, total=0))
        self.assertEqual(result, [])


@tagged('at_install', '-post_install')
class TestCreateProgressEmptyVals(common.TransactionCase):
    """
    Test _create_progress with empty vals_list
    """

    def setUp(self):
        super(TestCreateProgressEmptyVals, self).setUp()
        self.web_progress_obj = self.env['web.progress']
        cleanup_global_progress_state()

    def test_create_progress_empty_vals(self):
        """Test _create_progress with empty vals_list returns early"""
        result = self.web_progress_obj._create_progress([])
        self.assertIsNone(result)


@tagged('at_install', '-post_install')
class TestProgressWithRecurDepth(common.TransactionCase):
    """
    Test get_progress with parent depth recursion
    """

    def setUp(self):
        super(TestProgressWithRecurDepth, self).setUp()
        self.web_progress_obj = self.env['web.progress']
        cleanup_global_progress_state()

    def test_get_progress_with_parent_depth(self):
        """Test get_progress retrieves parent progress when recur_depth > 0"""
        progress_code = str(uuid.uuid4())

        with Registry(self.env.cr.dbname).cursor() as new_cr:
            new_env = api.Environment(new_cr, self.env.uid, self.env.context)
            progress_obj = new_env['web.progress']

            progress_obj.create({
                'code': progress_code,
                'recur_depth': 0,
                'msg': 'Parent',
                'progress': 50,
                'state': 'ongoing',
            })
            progress_obj.create({
                'code': progress_code,
                'recur_depth': 1,
                'msg': 'Child',
                'progress': 25,
                'state': 'ongoing',
            })
            new_cr.commit()

        result = self.web_progress_obj.get_progress(progress_code)
        self.assertGreaterEqual(len(result), 1)
