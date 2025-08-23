Adding progress tracking to your code
-------------------------------------

Prerequisites
=============
Progress reporting uses longpolling to send progress data from backend to web client, so make sure that the longpolling is operational before testing this module.


Simple case
===========

Typically when your code executes any long-running operation there is a loop over a `collection` in your code.

In order to report progress of the operation, wrap the `collection` with `self.web_progress_iter(collection, msg="Message")`

Say, your operation's main method looks as follows:

.. code-block::

    def action_operation(self):
        for rec in self:
            rec.do_somethig()


Then a progress-reporting-ready version would be:

.. code-block::

    def action_operation(self):
        for rec in self.web_progress_iter(self, msg="Message"):
            rec.do_something()


or a simpler version for recordsets:

.. code-block::

    def action_operation(self):
        for rec in self.with_progress(msg="Message"):
            rec.do_something()

Progress tracking may be added to sub-operations as well:

.. code-block::

    def action_operation(self):
        for rec in self.with_progress(msg="Message"):
            lines = rec.get_lines()
            for line in lines.with_progress("Sub-operation")
                line.do_something()

Advanced case
=============

This module adds methods `web_progress_iter` and `with_progress` to every Odoo model. The only difference between these methods is that `web_progress_iter` requires as its first parameter a collection to iterate upon and `with_progress` iterates always on `self`.

Both methods accept the following optional parameters:

- `msg` (str): an operation description, the message to be shown in the progress report,
- `total` (int): if provided, will be used as a length of the given collection, so `len(collection)` will never be called, which is essential when tracking progress of generators (default is `None`, i.e. `len` will be called),
- `cancellable` (bool): whether cancelling the operation should be possible, i.e visible button "Cancel" (default is `True`),
- `log_level` (str): which log level shall be used when logging progress (default is `"info"`).


.. code-block::

    def action_operation(self, data, length):
        for row in self.web_progress_iter(data, total=length, msg="Message",
                                          cancellable=True, log_level="debug"):
            self.do_something(row)

Another approach
================

You can also add iteration progress reporting to any recordset by adding `progress_iter=True` to its context.

FAQ
---

In this section you will find answers to the common questions concerning progress reporting implemented in `web_progress` module.

How to report a problem or ask a question?
==========================================

Please use the issue tracker of our GitHub repository to report problems or ask questions. You will find it here_.

.. _here: https://github.com/gmarczynski/odoo-web-progress/issues

How the progress reporting works?
=================================

The progress reporting system works through the following technical steps:

1. **Context injection**: The web client automatically injects a unique `progress_code` (UUID) into the context of every RPC call to the backend.

2. **Progress tracking**: When you use `web_progress_iter` or `with_progress`, the module creates a progress record in the database and starts tracking the iteration.

3. **Real-time updates**: Progress updates are sent to the web client through longpolling, allowing real-time display of progress bars.

4. **User interface**: The progress is displayed in a progress bar that can appear in different locations:
   - As a blocking modal dialog
   - In the system tray (top-right corner)
   - Minimized to the system tray on user request

5. **Cleanup**: When the operation completes or is cancelled, the progress record is automatically cleaned up.

**Technical implementation:**
- Progress records are stored in the `web.progress` model
- Each record contains: code (UUID), message, current progress, total, state, timestamps
- Longpolling uses the bus system to push updates to connected clients
- If longpolling fails, the system falls back to periodic HTTP polling

How each operation is identified?
=================================

1. Web client injects a unique `progress_code` (UUID) into the context of every RPC call towards backend.

2. Both  `web_progress_iter` and `with_progress` convert the given collection (or generator) into an instance of a generator-like class that uses a `progress_code` from context to perform progress tracking while your code iterates upon the collection.

3. Sheduled (cron) actions have their `progress_code` injected into the context by scheduler prior to their execution.

How often the progress is reported?
===================================

For each `progress_code` (i.e. a unique operation) the first interation (the first element) of the collection wrapped with `web_progress_iter` or `with_progress`  is reported to the web client (via longpolling).

After that, the progress is reported in intervals of minimum **5 seconds** (i.e. any access to any wrapped collection more than 5 seconds after the last reported progress is reported).

Also the final iteration (the last element) of the main wrapped collection (on the top-level) is reported.

What is the overhead of progress reporting?
===========================================

The overhead of progress reporting is minimal and carefully optimized:

**Database overhead:**
- Each progress update requires a single database write operation using a separate transaction
- Progress records are automatically cleaned up after completion or cancellation
- The module uses efficient SQL queries to minimize database load

**Network overhead:**
- Progress updates are sent via longpolling, which is very efficient for real-time communication
- If longpolling fails, the system falls back to periodic polling (every few seconds)
- Updates are batched to avoid excessive network traffic

**Memory overhead:**
- Progress tracking uses generator-like iterators, so no additional memory is consumed
- The original collection is not duplicated or modified
- Sub-progress tracking uses minimal additional memory for recursion depth tracking

**Performance impact:**
- Progress reporting adds negligible CPU overhead to the main operation
- The frequency of progress updates automatically adjusts based on operation speed
- For very fast operations (< 1 second), progress reporting may not appear at all

How the operation cancelling works?
===================================

Operation cancellation works through the following mechanism:

1. **User action**: User clicks the "Cancel" button in the progress dialog or system tray menu

2. **Database update**: The progress record's state is changed to 'cancel' in the database using a separate transaction

3. **Detection**: During each iteration, the progress iterator checks if the operation was cancelled by querying the database

4. **Exception raising**: If cancellation is detected, a `UserError`-type exception is raised with the message "Operation has been cancelled by [username]"

5. **Cleanup**: The progress record is automatically cleaned up, and the operation terminates

**Important notes:**
- Cancellation can only occur between iterations, not during the processing of individual items
- Operations with `cancellable=False` parameter cannot be cancelled
- The cancellation check happens in a separate transaction to ensure immediate detection
- Cancelled operations should be handled with appropriate exception handling in your code

How multi-level progress reporting works?
=========================================

Multi-level (nested) progress reporting creates a hierarchical progress display:

**Structure:**
- The main operation shows the overall progress (e.g., "Processing 100 records")
- Sub-operations show detailed progress within each main iteration (e.g., "Processing lines: 50/200")
- Multiple nesting levels are supported automatically

**Implementation details:**
- Each nested `with_progress()` or `web_progress_iter()` call creates a sub-progress record
- Sub-progress records are linked to their parent via the `recur_depth` field
- The UI displays nested progress bars with appropriate indentation
- Parent progress advances only when child operations complete

**Database structure:**
- All progress records share the same `code` (UUID) but have different `recur_depth` values
- Depth 0 = main operation, depth 1 = first level sub-operation, etc.
- Sub-progress records are automatically cleaned up with their parent

**Visual representation:**
- Main progress bar shows overall completion
- Sub-progress bars appear indented below the main bar
- Each level can have its own message, cancellation settings, and timing

**Example behavior:**
```
Main operation: 3/10 (30%)
  └─ Sub-operation: 150/200 (75%)
```

Is it possible to put an ongoing operation into background?
===========================================================

Yes, there are two ways to put operations into background:

1. **"Put to background" button**: Click this button in the progress dialog to minimize the operation to the system tray while keeping the UI responsive.

2. **F5 key**: Press F5 (standard Odoo behavior) to put any long-running operation into background.

The difference is that with the "Put to background" button, the progress tracking continues to be visible in the system tray menu, where users can:
- Monitor the progress of background operations
- Cancel operations if they are cancellable
- View multiple background operations simultaneously

**Important considerations:**
- Background operations cannot interact with the user after completion
- This is suitable for data imports (unless there are import errors)
- This is not suitable for data exports or reports that require user download after completion
- When there are no background operations, the system tray shows "No ongoing operations"


Is the current transaction commited to make progress visible?
=============================================================

No. Progress reporting uses a fresh transaction for each progress report and cancelled operation verification; therefore, the main transaction stays untouched and in total isolation.

However, it should be noted that since progress report records and longpolling messages are commited into the database, even if the main transaction is still not commited, the main transaction shall never inspect or change those records in order to avoid inter-transactional conflicts (update-in-parallel exceptions).


Does progress reporting work with reports?
==========================================

Yes, you can iterate over the wrapped collections in QWeb reports and the progress will be visible to the user.
