from app import app, db
from models import Image

with app.app_context():
    db.session.execute('ALTER TABLE image ADD COLUMN IF NOT EXISTS task_id VARCHAR(255)')
    db.session.commit()
    print('Database schema updated successfully') 