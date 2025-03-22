from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Patient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    patient_id = db.Column(db.String(255), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    images = db.relationship('Image', backref='patient', lazy=True)

    def __repr__(self):
        return f'<Patient {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'patient_id': self.patient_id,
            'created_at': self.created_at.isoformat(),
            'images': [image.to_dict() for image in self.images]
        }

class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    check_date = db.Column(db.DateTime, nullable=False)
    lesion_volume = db.Column(db.Float)
    tissue_stats = db.Column(db.JSON)
    processed_filename = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Image {self.filename}>'

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'patient_id': self.patient_id,
            'check_date': self.check_date.isoformat(),
            'lesion_volume': self.lesion_volume,
            'tissue_stats': self.tissue_stats,
            'processed_filename': self.processed_filename,
            'created_at': self.created_at.isoformat()
        } 