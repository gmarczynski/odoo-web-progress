====================
Dynamic Progress Bar
====================

Progress bar for Odoo waiting screen, possibility to cancel an ongoing operation and a sys tray menu for all operations in progress.

.. class:: no-web

    .. image:: https://raw.githubusercontent.com/gmarczynski/odoo-web-progress/14.0/web_progress/static/description/progress_bar_loading_cancelling.gif
        :alt: Progress Bar
        :width: 100%
        :align: center


**web_progress** is compatible with Odoo 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0 (CE and EE).

Author: Grzegorz Marczyński

License: LGPL-3.

Copyright © 2025 Grzegorz Marczyński


Features
--------

.. class:: no-web

    .. image:: https://raw.githubusercontent.com/gmarczynski/odoo-web-progress/14.0/web_progress/static/description/progress_bar_loading_systray.gif
        :alt: Progress Systray Menu
        :width: 50%
        :align: right

- Progress reporting for all standard Odoo import and export operations
- System tray menu that lists ongoing operations initiated by the logged user (all operations visible to Administrator)
- Support for all operations initiated through UI and executed by planned activities (cron)
- Generator-like method to simply add progress reporting to any iteration (support for sub-iterations)
- UI blocking feature (inactive by default in Odoo 17) with "Put to background" option
- Real-time progress updates via longpolling with fallback to periodic polling
- Operation cancellation with proper exception handling
- Multiple progress bar styles (standard, simple, nyan cat)
- Background operation management through system tray

For developers
---------------

Typically when your code executes any long-running operation there is a loop over a `collection` in your code.

In order to report progress of the operation, wrap the `collection` with `self.web_progress_iter(collection, msg="Message")`

Say, your operation's main method looks as follows:

.. code-block:: python

    def action_operation(self):
        for rec in self:
            rec.do_something()


Then a progress-reporting-ready version would be:

.. code-block:: python

    def action_operation(self):
        for rec in self.web_progress_iter(self, msg="Message"):
            rec.do_something()


or a simpler version for recordsets:

.. code-block:: python

    def action_operation(self):
        for rec in self.with_progress(msg="Message"):
            rec.do_something()

Progress tracking may be added to sub-operations as well:

.. code-block:: python

    def action_operation(self):
        for rec in self.with_progress(msg="Message"):
            lines = rec.get_lines()
            for line in lines.with_progress("Sub-operation"):
                line.do_something()

**Advanced usage:**

.. code-block:: python

    # For generators or when len() cannot be called
    for item in self.web_progress_iter(data_generator, total=10000, msg="Processing"):
        process_item(item)

    # With cancellation handling
    try:
        for rec in self.with_progress(msg="Critical operation"):
            rec.perform_task()
    except UserError as e:
        if "cancelled" in str(e):
            self.cleanup_after_cancel()

Both methods accept parameters: `msg`, `total`, `cancellable`, and `log_level`.

Release Notes
-------------

3.1 - 2025-09-07

- Minor fixes
- Added shine effect to progress bar

3.0 - 2025-08-24

- Port to Odoo 17.0 and Odoo 18.0
- Use OWL components to format progress and sub-progresses
- Add "put to background" button that unblocks the UI and opens the progress bar in the systray menu
- UI blocking feature (inactive by default in Odoo 17)

2.0 - 2023-01-29

- Port to Odoo 16.0

2.0 - 2021-08-22 - new functionality and fixes:

- add styles (standard, simple, nyan cat)
- make the progress bar appear directly when the screen becomes blocked
- keep basic progress functionality even if long polling is disabled or cease to work
- fix import of o2m fields for Odoo v13.0 and v0.14

1.4 - 2021-03-21 - fixes:

- fix deadlock on bus.bus garbage collection
- fix deadlock on access to res.users
- do not animate but set the progress bar going backwards


1.3 - 2019-07-15 - new functionality

- estimated time left / total


1.2 - 2019-06-24 - fixes:

- refactor global progress data
- change progress template name to avoid clash with progressbar widget

1.1 - 2019-06-23 - fixes:

- remove unecessary dependency on multiprocessing
- fix memory leak in time-tracking internal data

1.0 - 2019-06-20 - initial version

