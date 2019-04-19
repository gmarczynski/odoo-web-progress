from odoo import models, api, registry, fields, _
import logging

_logger = logging.getLogger(__name__)


class Base(models.AbstractModel):
    _inherit = 'base'

    #
    # Progress reporting
    #

    @api.model
    def report_progress_iter(self, data, msg='', total=None, cancellable=True, log_level="info"):
        """
        Progress reporting generator
        :param data: collection / generator to iterate onto
        :param msg: msg to mass in progress report
        :param total: provide total directly to avoid calling len on data (which fails on generators)
        :param cancellable: indicates whether the operation is cancellable
        :param log_level: log level to use when logging progress
        :return: yields every element of data
        """
        return self.env['web.progress']._report_progress(data,
                                                         msg=msg,
                                                         total=total,
                                                         cancellable=cancellable,
                                                         log_level=log_level)

    #
    # Add progress reporting to common time-consuming collections
    #

    @api.model
    def _extract_records(self, fields_, data, log=lambda a: None):
        """
        Add progress reporting to collection used in bas_import.import
        It adds progress reporting to all standard imports and additionally makes them cancellable
        """
        total = len(data)
        extracted = super(Base, self)._extract_records(fields_, data, log=log)
        return self.report_progress_iter(extracted, _("importing to {}").
                                         format(self._description.lower()), total=total, cancellable=True,
                                         log_level="debug")