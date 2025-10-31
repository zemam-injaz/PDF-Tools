"""
Application paths utility module
Provides functions to get proper paths for user data, databases, and settings
"""

import os
import sys
from pathlib import Path


def get_app_data_dir():
    """
    Get the application data directory for storing user data.

    Returns the appropriate directory based on the operating system:
    - Windows: ~/Documents/PDF_Tools_Pro
    - macOS: ~/Documents/PDF_Tools_Pro
    - Linux: ~/Documents/PDF_Tools_Pro

    Creates the directory if it doesn't exist.
    """
    if sys.platform == 'win32':
        # Windows: Use Documents folder for easier access
        # Get the user's Documents folder
        import ctypes.wintypes
        CSIDL_PERSONAL = 5  # My Documents
        SHGFP_TYPE_CURRENT = 0  # Get current, not default value

        buf = ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH)
        ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_PERSONAL, None, SHGFP_TYPE_CURRENT, buf)
        documents_dir = buf.value

        app_dir = os.path.join(documents_dir, 'PDF_Tools_Pro')
    elif sys.platform == 'darwin':
        # macOS: Use Documents folder
        app_dir = os.path.expanduser('~/Documents/PDF_Tools_Pro')
    else:
        # Linux: Use Documents folder
        app_dir = os.path.expanduser('~/Documents/PDF_Tools_Pro')

    # Create directory if it doesn't exist
    os.makedirs(app_dir, exist_ok=True)

    return app_dir


def get_database_path(db_name):
    """
    Get the full path for a database file.
    
    Args:
        db_name: Name of the database file (e.g., 'recent_books.db')
    
    Returns:
        Full path to the database file in the app data directory
    """
    return os.path.join(get_app_data_dir(), db_name)


def get_settings_path(settings_name):
    """
    Get the full path for a settings file.
    
    Args:
        settings_name: Name of the settings file (e.g., 'pdf_tools_settings.json')
    
    Returns:
        Full path to the settings file in the app data directory
    """
    return os.path.join(get_app_data_dir(), settings_name)


def get_thumbnails_dir():
    """
    Get the thumbnails directory path.
    
    Returns:
        Full path to the thumbnails directory in the app data directory
    """
    thumbnails_dir = os.path.join(get_app_data_dir(), 'thumbnails')
    os.makedirs(thumbnails_dir, exist_ok=True)
    return thumbnails_dir


def get_temp_dir():
    """
    Get a temporary directory for the application.
    
    Returns:
        Full path to the temp directory in the app data directory
    """
    temp_dir = os.path.join(get_app_data_dir(), 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    return temp_dir


def migrate_old_data():
    """
    Migrate old data files from the application directory to the user data directory.
    This is called on first run to move existing databases and settings.
    """
    # Get the directory where the script/executable is located
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        old_dir = os.path.dirname(sys.executable)
    else:
        # Running as script
        old_dir = os.path.dirname(os.path.abspath(__file__))
    
    new_dir = get_app_data_dir()
    
    # List of files to migrate
    files_to_migrate = [
        'recent_books.db',
        'pdf_reading_progress.db',
        'pdf_tools_settings.json',
        'pdf_tools_history.json',
        'reading_statistics.json'
    ]
    
    migrated_files = []
    
    for filename in files_to_migrate:
        old_path = os.path.join(old_dir, filename)
        new_path = os.path.join(new_dir, filename)
        
        # Only migrate if old file exists and new file doesn't
        if os.path.exists(old_path) and not os.path.exists(new_path):
            try:
                import shutil
                shutil.copy2(old_path, new_path)
                migrated_files.append(filename)
                print(f"✅ Migrated {filename} to {new_dir}")
            except Exception as e:
                print(f"⚠️ Failed to migrate {filename}: {e}")
    
    # Migrate thumbnails directory
    old_thumbnails = os.path.join(old_dir, 'thumbnails')
    new_thumbnails = get_thumbnails_dir()
    
    if os.path.exists(old_thumbnails) and os.path.isdir(old_thumbnails):
        try:
            import shutil
            for item in os.listdir(old_thumbnails):
                old_item = os.path.join(old_thumbnails, item)
                new_item = os.path.join(new_thumbnails, item)
                if os.path.isfile(old_item) and not os.path.exists(new_item):
                    shutil.copy2(old_item, new_item)
            print(f"✅ Migrated thumbnails to {new_thumbnails}")
        except Exception as e:
            print(f"⚠️ Failed to migrate thumbnails: {e}")
    
    if migrated_files:
        print(f"📦 Migration complete: {len(migrated_files)} files migrated")
    
    return migrated_files


# Initialize app data directory on module import
_app_data_dir = get_app_data_dir()
print(f"📁 Application data directory: {_app_data_dir}")

