{
    'name': "Dynamic Progress Bar",

    'summary': """
        Enhanced progress bar for long-running operations.
    """,

    'description': """
        Adds dynamic progress bar with expandable sub-progress details and cancel button to gray waiting screen.
        Features:
        - Enhanced UI blocking with "Put to background" functionality
        - Composite component architecture with modular sub-components
        - Expandable/collapsible detailed progress view
        - Multiple style themes (standard, simple, nyan)
        - Reactive progress updates
        - Systray integration with dropdown menu
        Try to import some CSV file to any model to see it in action.
    """,

    'author': "Grzegorz Marczyński",
    'category': 'Productivity',
    'website': 'https://github.com/gmarczynski/odoo-web-progress',

    'version': '18.0.3.1',

    'depends': ['web',
                'bus',
                'base_import',
                ],

    'data': [
        'security/ir.model.access.csv',
    ],
    'assets': {
        'web.assets_backend': [

            # Templates
            'web_progress/static/src/xml/progress_bar.xml',
            'web_progress/static/src/xml/web_progress_menu.xml',

            # Styles
            'web_progress/static/src/scss/views.scss',
            'web_progress/static/src/scss/views_styles.scss',

            # Sub-components
            'web_progress/static/src/js/progress_bar_header.js',
            'web_progress/static/src/js/progress_bar_body.js',
            'web_progress/static/src/js/progress_bar_sub_item.js',
            'web_progress/static/src/js/progress_bar_sub_list.js',

            # Main components
            'web_progress/static/src/js/progress_bar.js',
            'web_progress/static/src/js/progress_menu.js',

            # Patches
            'web_progress/static/src/js/block_ui_patch.js',
            'web_progress/static/src/js/import_block_ui_patch.js',

            # Core services
            'web_progress/static/src/js/rpc_service.js',
            'web_progress/static/src/js/progress_service.js',
        ],
    },
    'demo': [
    ],
    'images': ['static/description/progress_bar_loading_compact.gif',
               'static/description/progress_bar_loading_cancelling.gif',
               'static/description/progress_bar_loading_systray.gif',
               ],

    'license': 'LGPL-3',

    'installable': True,
    'auto_install': True,
    'application': False,
}
