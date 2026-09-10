import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

from app import create_app, db
from app.models import Order, OrderItem

app = create_app()

with app.app_context():
    print("Deleting all order items...")
    OrderItem.query.delete()
    print("Deleting all orders...")
    Order.query.delete()
    db.session.commit()
    print("All orders deleted successfully.")
