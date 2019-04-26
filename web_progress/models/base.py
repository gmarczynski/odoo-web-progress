from odoo import models, api, registry, fields, _
import logging

_logger = logging.getLogger(__name__)

models_iter = models.BaseModel.__iter__


class GeneratorWithLenIndexable(object):
    """
    A class that mimics a generator, but also supports length and indexing
    """
    def __init__(self, gen, length, data):
        self.gen = gen
        self.length = length
        self.data = data

    def __len__(self):
        return self.length

    def __iter__(self):
        return self.gen

    def __getitem__(self, key):
        return self.data.__getitem__(key)


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
        return GeneratorWithLenIndexable(self.env['web.progress']._report_progress(data,
                                                                                   msg=msg,
                                                                                   total=total,
                                                                                   cancellable=cancellable,
                                                                                   log_level=log_level),
                                         total or len(data),
                                         data)

    #
    # Add progress reporting to common time-consuming collections
    #

    def __iter__(self):
        """
        Add progress report to recordset iteration when progress_iter is in the context
        """
        if self._context.get('progress_iter'):
            self = self.with_context(progress_iter=False)
            return self.report_progress_iter(self, _("Iterating on model {}").format(self._description)).__iter__()
        else:
            return super(Base, self).__iter__()

    @api.model
    def _extract_records(self, fields_, data, log=lambda a: None):
        """
        Add progress reporting to collection used in bas_import.import
        It adds progress reporting to all standard imports and additionally makes them cancellable
        """
        if 'progress_code' in self._context:
            data = self.report_progress_iter(data, _("Importing to model {}").
                                             format(self._description), cancellable=True,
                                             log_level="debug")
        return super(Base, self)._extract_records(fields_, data, log=log)


    @api.multi
    def _export_rows(self, fields, batch_invalidate=True):
        """
        Add progress_iter to the context in order to track progress of iterations inside exporting method
        """
        if 'progress_code' in self._context:
            return super(Base, self.with_context(progress_iter=True)).\
                _export_rows(fields, batch_invalidate=batch_invalidate)
        return super(Base, self)._export_rows(fields, batch_invalidate=batch_invalidate)