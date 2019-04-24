from odoo import models, api, registry, fields, _
from odoo.exceptions import UserError


class BaseImport(models.TransientModel):
    _inherit = 'base_import.import'

    def do(self, *args, **kwargs):
        """
        Catch UserError exception and pass it as an error.
        Re-raise all other errors
        """
        try:
            ret = super(BaseImport, self).do(*args, **kwargs)
        except UserError as e:
            ret = [{'type': 'warning', 'message': e.name}]
        except Exception:
            raise
        return ret