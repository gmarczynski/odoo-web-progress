![Progress Bar](https://raw.githubusercontent.com/gmarczynski/odoo-web-progress/14.0/web_progress/static/description/progress_bar_loading_cancelling.gif)

# Odoo module web_progress

Progress bar for Odoo waiting screen, possibility to cancel an ongoing operation and a sys tray menu for all operations in progress.

**web_progress** is compatible with Odoo 11.0, 12.0, 13.0, 14.0, 15.0, 16.0 (CE and EE).

Author: Grzegorz Marczyński

License: LGPL-3.

## Features

- progress reporting for all standard Odoo import and export operations
- sys tray menu that lists ongoing operations initiated by the logged user (all operations visible to Administrator)
- support for all operations initiated through UI and executed by planned activities (cron)
- generator-like method to simply add progress reporting to any iteration (support for sub-iterations)

## For developers

Typically when your code executes any long-term operation there is a loop over a `collection` in your code.

In order to report progress of the operation, wrap the `collection` with `self.web_progress_iter(collection, msg="Message")`

Say, your action method looks as follows:
```(python)
@api.multi
def action_operation(self):
    for rec in self:
        rec.do_somethig()
```
Then a progress-reporting-ready version would be:
```(python)
@api.multi
def action_operation(self):
    for rec in self.web_progress_iter(self, msg="Message"):
        rec.do_somethig()
```
See the module's documentation for more information.



 