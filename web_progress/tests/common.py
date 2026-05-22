# Part of web_progress. See LICENSE file for full copyright and licensing details.
"""
Common test utilities for web_progress tests
"""
from ..models.web_progress import last_report_time, first_report_time, recur_depths, progress_data, user_name


def cleanup_global_progress_state():
    """
    Clean up global progress state dictionaries.
    Should be called in test cleanup to ensure isolation.
    """
    last_report_time.clear()
    first_report_time.clear()
    recur_depths.clear()
    progress_data.clear()
    user_name.clear()
