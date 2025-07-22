{
    'name': "Dynamic Progress Bar",

    'summary': """
        Enhanced progress bar with composite components for operations that take more than 5 seconds.
    """,

    'description': """
        Adds dynamic progress bar with expandable sub-progress details and cancel button to gray waiting screen.
        Features:
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

    'version': '17.0.3.0',

    'depends': ['web',
                'bus',
                'base_import',
                ],

    'data': [
        'security/ir.model.access.csv',
    ],
    'assets': {
        'web.assets_backend': [
            # Styles
            'web_progress/static/src/scss/views.scss',
            'web_progress/static/src/scss/views_styles.scss',

            # Core services
            'web_progress/static/src/js/progress_service.js',

            # Sub-components (loaded first)
            'web_progress/static/src/js/progress_bar_header.js',
            'web_progress/static/src/js/progress_bar_body.js',
            'web_progress/static/src/js/progress_bar_sub_item.js',
            'web_progress/static/src/js/progress_bar_sub_list.js',

            # Main components (loaded after sub-components)
            'web_progress/static/src/js/progress_bar.js',
            'web_progress/static/src/js/progress_menu.js',

            # Templates
            'web_progress/static/src/xml/progress_bar.xml',
            'web_progress/static/src/xml/web_progress_menu.xml',
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