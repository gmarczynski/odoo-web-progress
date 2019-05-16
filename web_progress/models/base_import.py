from odoo import models, api, registry, fields, _
from odoo.exceptions import UserError


class BaseImport(models.TransientModel):
    _inherit = 'base_import.import'

    @api.multi
    def do(self, fields, columns, options, dryrun=False):
        """
        Catch UserError exception and pass it as an error.
        Re-raise all other errors
        """
        try:
            ret = super(BaseImport, self).do(fields, columns, options, dryrun=dryrun)
        except UserError as e:
            ret = [{'type': 'warning', 'message': e.name}]
        except Exception:
            raise
        return ret