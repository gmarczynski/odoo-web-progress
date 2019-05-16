from odoo import models, api, registry, fields, _
import logging

_logger = logging.getLogger(__name__)


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
    def report_progress_percent(self, percent, msg='', cancellable=True, log_level="info"):
        """
        Report progress of an ongoing operation identified by progress_code in context.
        :param percent: progress in percent
        :param msg: progress message
        :param cancellable: indicates whether the operation is cancellable
        :param log_level: log level to use when logging progress
        :return: None
        """
        code = self.env.context.get('progress_code')
        if not code:
            return
        web_progress_obj = self.env['web.progress']
        percent = max(min(percent, 100), 0)
        recur_depth = web_progress_obj._get_recur_depth(code)
        if percent >= 100:
            web_progress_obj._report_progress_done(code, 100, msg, recur_depth, cancellable, log_level)
        else:
            web_progress_obj._report_progress_do_percent(code=code,
                                                         num=percent,
                                                         total=100,
                                                         msg=msg,
                                                         recur_depth=recur_depth,
                                                         cancellable=cancellable,
                                                         log_level=log_level)

    @api.model
    def report_progress_iter(self, data, msg='', total=None, cancellable=True, log_level="info"):
        """
        Progress reporting generator of an ongoing operation identified by progress_code in context.
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
        Add progress reporting to collection used in base_import.import
        It adds progress reporting to all standard imports and additionally makes them cancellable
        """
        ret = super(Base, self)._extract_records(fields_, data, log=log)
        if 'progress_code' in self._context:
            return self.report_progress_iter(ret, _("Importing to model {}").
                                             format(self._description), cancellable=True,
                                             total=len(data),
                                             log_level="debug")
        return ret


    @api.multi
    def _export_rows(self, fields, *args, _is_toplevel_call=True):
        """
        Add progress_iter to the context in order to track progress of iterations inside exporting method
        """
        if 'progress_code' in self._context:
            return super(Base, self.with_context(progress_iter=True)).\
                _export_rows(fields, *args, _is_toplevel_call=_is_toplevel_call)
        return super(Base, self)._export_rows(fields, *args, _is_toplevel_call=_is_toplevel_call)