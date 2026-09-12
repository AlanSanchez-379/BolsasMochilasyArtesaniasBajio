import re
from dotenv import load_dotenv
load_dotenv()
from app import create_app
from app.extensions import db
from app.models import Product

app = create_app()

def migrate_product_fields():
    with app.app_context():
        products = Product.query.all()
        updated_count = 0
        
        for p in products:
            if not p.description:
                continue
                
            desc = p.description
            
            # Find Material
            material_match = re.search(r'\*\*Material:\*\*\s*(.*?)(?=\n\*\*|\n\n\*\*|$)', desc, flags=re.IGNORECASE | re.DOTALL)
            if material_match:
                p.material = material_match.group(1).strip()
                desc = desc.replace(material_match.group(0), '')
                
            # Find Medidas
            medidas_match = re.search(r'\*\*Medidas:\*\*\s*(.*?)(?=\n\*\*|\n\n\*\*|$)', desc, flags=re.IGNORECASE | re.DOTALL)
            if medidas_match:
                p.medidas = medidas_match.group(1).strip()
                desc = desc.replace(medidas_match.group(0), '')
                
            # Find Características
            carac_match = re.search(r'\*\*Características:\*\*\s*(.*?)(?=\n\*\*|\n\n\*\*|$)', desc, flags=re.IGNORECASE | re.DOTALL)
            if carac_match:
                p.caracteristicas = carac_match.group(1).strip()
                desc = desc.replace(carac_match.group(0), '')
                
            p.description = desc.strip()
            
            if material_match or medidas_match or carac_match:
                updated_count += 1
                
        db.session.commit()
        print(f"Migrated {updated_count} products.")

if __name__ == '__main__':
    migrate_product_fields()
