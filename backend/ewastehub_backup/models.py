from datetime import datetime
from .extensions import db

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    # consumer / staff / admin
    role = db.Column(db.String(20), nullable=False, default="consumer")

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_public_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat(),
        }

class CollectionRequest(db.Model):
    __tablename__ = "collection_requests"

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    consumer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    consumer = db.relationship("User", backref="collection_requests")

    item_name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(50), nullable=False)          # e.g. phone/laptop/battery/other
    condition = db.Column(db.String(50), nullable=False)         # working/broken/unknown
    preferred_method = db.Column(db.String(20), nullable=False)  # dropoff/pickup

    status = db.Column(db.String(20), nullable=False, default="submitted")  # submitted/approved/rejected/completed

    def to_dict(self):
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "consumer_id": self.consumer_id,
            "item_name": self.item_name,
            "category": self.category,
            "condition": self.condition,
            "preferred_method": self.preferred_method,
            "status": self.status,
        }

class Device(db.Model):
    __tablename__ = "devices"

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    owner = db.relationship("User", backref="devices")

    # user input
    name = db.Column(db.String(120), nullable=False)           # e.g. iPhone X
    device_type = db.Column(db.String(50), nullable=False)     # phone/laptop/tablet/console/other
    condition = db.Column(db.String(50), nullable=False)       # working/broken/unknown
    age_years = db.Column(db.Integer, nullable=True)           # optional
    demand = db.Column(db.String(20), nullable=True)           # high/medium/low/unknown (optional)

    # system/staff fields
    classification = db.Column(db.String(20), nullable=False, default="unknown")
    workflow_status = db.Column(db.String(20), nullable=False, default="pending")
    notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "owner_id": self.owner_id,
            "name": self.name,
            "device_type": self.device_type,
            "condition": self.condition,
            "age_years": self.age_years,
            "demand": self.demand,
            "classification": self.classification,
            "workflow_status": self.workflow_status,
            "notes": self.notes,
        }