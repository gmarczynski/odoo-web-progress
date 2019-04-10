{
    'name': "Web Progress",

    'summary': """
        Progress bar for operations that take more than 5 seconds.
    """,

    'description': """
    Adds dynamic progress bar and cancel button to gray waiting screen. 
    Try to import some CSV file to any model to see it in action.
    """,

    'author': "Grzegorz Marczyński",
    'category': 'UI',

    'version': '1.0',

    'depends': ['web'],

    'data': [
        'views/templates.xml',
    ],

    'qweb': [
        'static/src/xml/progress_bar.xml',
        ],

    'demo': [
    ],

    'license': 'LGPL-3',

    'installable': True,
    'auto_install': True,
    'application': False,
}
