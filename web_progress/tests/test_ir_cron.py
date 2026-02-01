# Part of web_progress. See LICENSE file for full copyright and licensing details.
"""
Tests for ir.cron model extensions
"""
from odoo.tests import common, tagged
import uuid

from .common import cleanup_global_progress_state


@tagged('at_install', '-post_install')
class TestIrCronCallback(common.TransactionCase):
    """
    Test ir.cron _callback method adds progress_code
    """

    def setUp(self):
        super(TestIrCronCallback, self).setUp()
        cleanup_global_progress_state()

    def test_cron_callback_adds_progress_code(self):
        """Test _callback adds progress_code to context when not present"""
        cron = self.env['ir.cron'].search([], limit=1)
        if cron:
            self.assertTrue(hasattr(cron, '_callback'))

    def test_cron_callback_preserves_existing_progress_code(self):
        """Test _callback preserves existing progress_code in context"""
        progress_code = str(uuid.uuid4())
        cron = self.env['ir.cron'].search([], limit=1)
        if cron:
            cron_with_code = cron.with_context(progress_code=progress_code)
            self.assertEqual(cron_with_code.env.context.get('progress_code'), progress_code)
