"""Execute the actual checkout calculation with in-memory products only.
No app is imported, no database is connected, and execution stops before shipping/order persistence.
"""
import ast
import json
import pathlib
from types import SimpleNamespace, MethodType

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).parent
products = json.loads((OUT / "public-products.json").read_text(encoding="utf-8"))
chosen = [next(p for p in products if p["slug"] == slug) for slug in ["bolso-oleaje-artesanal", "mochila-plana-animada"]]
tree = ast.parse((ROOT / "backend/app/models/product.py").read_text(encoding="utf-8"))
price_method = next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=="price_for_quantity")
namespace = {}
exec(compile(ast.Module(body=[price_method],type_ignores=[]),"product.price_for_quantity","exec"),namespace)
ps = [SimpleNamespace(**p) for p in chosen]
for p in ps: p.price_for_quantity = MethodType(namespace["price_for_quantity"],p)
vs = [SimpleNamespace(id=p["variants"][0]["id"],product_id=p["id"],stock=100,color=p["variants"][0]["color"]) for p in chosen]

class Query:
    def __init__(self,items): self.items=items
    def filter(self,*args): return self
    def with_for_update(self): return self
    def all(self): return self.items

lines=[]
class StopBeforeShipping(Exception): pass
def stop(*args): raise StopBeforeShipping()
def order_item(**kwargs):
    item=SimpleNamespace(**kwargs)
    lines.append(item)
    return item

env={"Product":SimpleNamespace(query=Query(ps),id=SimpleNamespace(in_=lambda values:None)),"ProductVariant":SimpleNamespace(query=Query(vs),id=SimpleNamespace(in_=lambda values:None)),"OrderItem":order_item,"CheckoutError":ValueError,"_cost_price":lambda product:0,"_is_domestic":stop}
tree=ast.parse((ROOT / "backend/app/blueprints/checkout/routes.py").read_text(encoding="utf-8"))
function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="_build_order")
exec(compile(ast.Module(body=[function],type_ignores=[]),"checkout._build_order","exec"),env)
payload=[{"type":"simple","product_id":p.id,"variant_id":v.id,"quantity":3} for p,v in zip(ps,vs)]
try: env["_build_order"](payload,{},"spei")
except StopBeforeShipping: pass
result={"mode":"actual source executed with in-memory fixtures; stopped before shipping or persistence","items":[{"name":p.name,"category":p.category,"print_type":p.print_type,"subcategory":p.subcategory,"quantity":3,"frontend_unit":p.price_for_quantity(3),"backend_unit":line.unit_price} for p,line in zip(ps,lines)],"frontend_subtotal":sum(p.price_for_quantity(3)*3 for p in ps),"backend_subtotal":sum(line.unit_price*line.quantity for line in lines)}
(OUT/"pricing-reproduction.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(result,ensure_ascii=False,indent=2))
