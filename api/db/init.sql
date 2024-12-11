INSERT INTO app_role
("name", permissions)
VALUES('Admin', '[{"resource":"site","path":["/secure/dashboard","/secure/profile"]},{"resource":"roles","path":"/secure/roles","policies":[{"action":"read","path":"","properties":["name","permissions"]},{"action":"add","path":"/new","properties":["name","permissions"]},{"action":"edit","path":"/edit","properties":["name","permissions"]},{"action":"delete"}]},{"resource":"users","path":"/secure/users","policies":[{"action":"read","path":"","properties":["fullname","email","phone","location"]},{"action":"add","path":"/new","properties":["fullname","email","phone","location","role","password"]},{"action":"edit","path":"/edit","properties":["fullname","email","phone","location","role"]},{"action":"delete"}]},{"resource":"products","path":"/secure/products","policies":[{"action":"price","path":"/price","properties":["title","description"]},{"action":"add","path":"/new","properties":["title","description"]},{"action":"edit","path":"/edit","properties":["title"]},{"action":"delete"}]},{"resource":"purchases","path":["/secure/purchases","/secure/purchases/vendors"],"policies":[{"action":"read","path":"/list","properties":["name"]},{"action":"add","path":"/new","properties":["name"]},{"action":"edit","path":"/edit","properties":["name"]},{"action":"vendors.edit","path":"vendors/edit","properties":["name"]},{"action":"delete"}]},{"resource":"store","path":["/secure/store/stock","/secure/store/cash"],"policies":[{"action":"read","properties":["ptrcost"]},{"action":"adjust"}]},{"resource":"customers","path":"/secure/customers","policies":[{"action":"read","properties":[]}]},{"resource":"sales","path":["/secure/sales/pos","/secure/sales/pos/new","/secure/sales/list","/secure/sales/view","/secure/sales/new","/secure/sales/edit","/secure/sales/returns","/secure/sales/reminders"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]},{"action":"bill","path":"/bill/print"}]},{"resource":"settings","path":["/secure/settings","/secure/settings/users","/secure/settings/roles","/secure/settings/app"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]}]},{"resource":"reports","path":["/secure/reports"]}]');

insert into app_user(email,full_name,password,role_id) values ('admin@rgp.com','Admin','$2a$10$ziCbexMTYGkEHjbpL9C2HeWo/QpkQJTITU9VVxPHcpYXEye3UcDqe',(select id from app_role where name = 'Admin'))

insert into customer ("name",mobile) values ('NIL','0000000000');