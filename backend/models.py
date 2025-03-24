from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    patients = db.relationship('Patient', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'created_at': self.created_at.isoformat()
        }

class Patient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    patient_id = db.Column(db.String(255), unique=True, nullable=False)
    age = db.Column(db.Integer)
    gender = db.Column(db.String(10))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    images = db.relationship('Image', backref='patient', lazy=True)

    def __repr__(self):
        return f'<Patient {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'patient_id': self.patient_id,
            'age': self.age,
            'gender': self.gender,
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
    processed = db.Column(db.Boolean, default=False)
    processing_error = db.Column(db.String(255))
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
            'processed': self.processed,
            'processing_error': self.processing_error,
            'created_at': self.created_at.isoformat()
        } 