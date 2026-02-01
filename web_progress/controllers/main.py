import json
import logging
from odoo import http, _
from odoo.http import request
from odoo.addons.web.controllers.report import ReportController

_logger = logging.getLogger(__name__)


class WPReportController(ReportController):

    @http.route(['/report/download'], type='http', auth="user")
    def report_download(self, data, context=None, token=None):
        """
        Get web progress code from the context and report progress during download
        """
        parsed_context = json.loads(context or '{}')
        progress_code = parsed_context.get('progress_code')

        if not progress_code:
            # No progress tracking requested
            return super(WPReportController, self).report_download(data, context, token)

        web_progress_obj = request.env['web.progress'].with_context(**parsed_context)

        try:
            web_progress_obj.web_progress_percent(0, 'Starting report')
            ret = super(WPReportController, self).report_download(data, context, token)
            web_progress_obj.web_progress_percent(100, 'Report completed')
            return ret
        except Exception as e:
            # Report failure and re-raise
            _logger.warning("Report download failed with progress code %s: %s", progress_code, e)
            try:
                # Try to mark progress as done even on error so the progress bar closes
                web_progress_obj.web_progress_percent(100, 'Report failed')
            except Exception:
                pass  # Don't mask the original exception
            raise

class WebProgressController(http.Controller):

    @http.route(['/web/progress/cancel'], type='jsonrpc', auth="user")
    def cancel_progress(self, progress_code):
        """
        Cancel a progress operation
        """
        web_progress_obj = request.env['web.progress']
        return web_progress_obj.cancel_progress(progress_code)