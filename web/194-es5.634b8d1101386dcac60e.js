!function(){"use strict";function t(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function e(t,e){for(var n=0;n<e.length;n++){var i=e[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}function n(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),Object.defineProperty(t,"prototype",{writable:!1}),t}(self.webpackChunkfrontend=self.webpackChunkfrontend||[]).push([[194],{8194:function(e,i,o){o.r(i),o.d(i,{SettingsModule:function(){return qt}});var r,s=o(8583),u=o(665),c=o(6516),a=o(8598),l=o(8288),f=o(2561),p=o(4466),m=o(5121),d=o(4748),h=o(705),v=o(7872),Z=o(7716),g=o(2340),A=o(1841),b=((r=function(){function e(n){t(this,e),this.http=n,this.apiurl="".concat(g.N.apiHost,"/settings")}return n(e,[{key:"save",value:function(t){return this.http.post("".concat(this.apiurl),t)}},{key:"remove",value:function(t){return this.http.delete("".concat(this.apiurl,"/").concat(t))}},{key:"update",value:function(t,e){return this.http.put("".concat(this.apiurl,"/").concat(t),e)}},{key:"find",value:function(t){return this.http.get("".concat(this.apiurl,"/").concat(t))}},{key:"findAll",value:function(t){return this.http.get("".concat(this.apiurl),{params:t})}}]),e}()).\u0275fac=function(t){return new(t||r)(Z.LFG(A.eN))},r.\u0275prov=Z.Yz7({token:r,factory:r.\u0275fac,providedIn:"root"}),r),q=o(2777),T=function(){return["is-active"]};function y(t,e){1&t&&(Z.TgZ(0,"li",4),Z.TgZ(1,"a",5),Z._uU(2,"Roles"),Z.qZA(),Z.qZA()),2&t&&(Z.xp6(1),Z.Q6J("routerLinkActive",Z.DdM(1,T)))}function N(t,e){1&t&&(Z.TgZ(0,"li",4),Z.TgZ(1,"a",6),Z._uU(2,"Users"),Z.qZA(),Z.qZA()),2&t&&(Z.xp6(1),Z.Q6J("routerLinkActive",Z.DdM(1,T)))}function k(t,e){1&t&&(Z.TgZ(0,"li",4),Z.TgZ(1,"a",7),Z._uU(2,"Application"),Z.qZA(),Z.qZA()),2&t&&(Z.xp6(1),Z.Q6J("routerLinkActive",Z.DdM(1,T)))}var x=function(){var e=function(){function e(n){t(this,e),this.service=n}return n(e,[{key:"ngOnInit",value:function(){}}]),e}();return e.\u0275fac=function(t){return new(t||e)(Z.Y36(b))},e.\u0275cmp=Z.Xpm({type:e,selectors:[["app2-settings"]],decls:9,vars:0,consts:[[1,"pagetitle"],[1,"navbar","navbar-light","bg-light","justify-content-between","non-print","m-0","p-0"],[1,"nav"],["class","nav-item",4,"isNavAuth"],[1,"nav-item"],["routerLink","/secure/settings/roles",1,"nav-link",3,"routerLinkActive"],["routerLink","/secure/settings/users",1,"nav-link",3,"routerLinkActive"],["routerLink","/secure/settings/app",1,"nav-link",3,"routerLinkActive"]],template:function(t,e){1&t&&(Z.TgZ(0,"div",0),Z.TgZ(1,"h1"),Z._uU(2,"Settings"),Z.qZA(),Z.qZA(),Z.TgZ(3,"nav",1),Z.TgZ(4,"ul",2),Z.YNc(5,y,3,2,"li",3),Z.YNc(6,N,3,2,"li",3),Z.YNc(7,k,3,2,"li",3),Z.qZA(),Z.qZA(),Z._UZ(8,"router-outlet"))},directives:[q.x,l.lC,l.yS,l.Od],encapsulation:2}),e}(),w=function(){var e=n(function e(){t(this,e)});return e.\u0275fac=function(t){return new(t||e)},e.\u0275cmp=Z.Xpm({type:e,selectors:[["ng-component"]],decls:1,vars:0,template:function(t,e){1&t&&Z._UZ(0,"router-outlet")},directives:[l.lC],encapsulation:2}),e}(),_=o(9091),J=function(){var e=function(){function e(n){t(this,e),this.appStateService=n}return n(e,[{key:"ngOnInit",value:function(){this.appStateService.state.next({title:"Roles"})}}]),e}();return e.\u0275fac=function(t){return new(t||e)(Z.Y36(_.Z))},e.\u0275cmp=Z.Xpm({type:e,selectors:[["ng-component"]],decls:1,vars:0,template:function(t,e){1&t&&Z._UZ(0,"router-outlet")},directives:[l.lC],encapsulation:2}),e}(),U=function(){var e=function(){function e(n){t(this,e),this.http=n,this.API_SERVER=g.N.apiHost}return n(e,[{key:"findAll",value:function(){return this.http.get("".concat(this.API_SERVER,"/roles"))}},{key:"save",value:function(t){return this.http.post("".concat(this.API_SERVER,"/roles"),t)}},{key:"update",value:function(t,e){return this.http.put("".concat(this.API_SERVER,"/roles/").concat(t),e)}},{key:"remove",value:function(t){return this.http.delete("".concat(this.API_SERVER,"/roles/").concat(t))}},{key:"findById",value:function(t){return this.http.get("".concat(this.API_SERVER,"/roles/").concat(t))}}]),e}();return e.\u0275fac=function(t){return new(t||e)(Z.LFG(A.eN))},e.\u0275prov=Z.Yz7({token:e,factory:e.\u0275fac,providedIn:"root"}),e}(),Y=o(1312),Q=function(){return["../new"]};function I(t,e){1&t&&(Z.TgZ(0,"a",2),Z.TgZ(1,"button",3),Z._uU(2,"Add New"),Z.qZA(),Z.qZA()),2&t&&Z.Q6J("routerLink",Z.DdM(1,Q))}function L(t,e){1&t&&(Z.TgZ(0,"th",5),Z._uU(1,"Name"),Z.qZA())}function S(t,e){1&t&&(Z.TgZ(0,"th",5),Z._uU(1,"Permissions"),Z.qZA())}function $(t,e){if(1&t&&(Z.TgZ(0,"td"),Z._uU(1),Z.qZA()),2&t){var n=Z.oxw().$implicit;Z.xp6(1),Z.Oqu(n.name)}}function O(t,e){if(1&t&&(Z.TgZ(0,"td"),Z._uU(1),Z.qZA()),2&t){var n=Z.oxw().$implicit;Z.xp6(1),Z.Oqu(n.permissions)}}var C=function(t){return["../edit",t]};function F(t,e){if(1&t&&(Z.TgZ(0,"a",2),Z._UZ(1,"i",11),Z.qZA()),2&t){var n=Z.oxw().$implicit;Z.Q6J("routerLink",Z.VKq(1,C,n.id))}}function R(t,e){if(1&t){var n=Z.EpF();Z.TgZ(0,"a",12),Z.NdJ("click",function(){Z.CHM(n);var t=Z.oxw().$implicit;return Z.oxw(2).delete(t.id)}),Z._UZ(1,"i",13),Z.qZA()}}function V(t,e){if(1&t&&(Z.TgZ(0,"tr"),Z.TgZ(1,"td"),Z._uU(2),Z.qZA(),Z.YNc(3,$,2,1,"td",9),Z.YNc(4,O,2,1,"td",9),Z.TgZ(5,"td"),Z.YNc(6,F,2,3,"a",0),Z.YNc(7,R,2,0,"a",10),Z.qZA(),Z.qZA()),2&t){var n=e.$implicit;Z.xp6(2),Z.Oqu(n.id),Z.xp6(1),Z.Q6J("isAuth","roles.read$name"),Z.xp6(1),Z.Q6J("isAuth","roles.read$permissions"),Z.xp6(2),Z.Q6J("isAuth","roles.edit"),Z.xp6(1),Z.Q6J("isAuth","roles.delete")}}function E(t,e){if(1&t&&(Z.TgZ(0,"table",4),Z.TgZ(1,"thead"),Z.TgZ(2,"tr"),Z.TgZ(3,"th",5),Z._uU(4,"ID"),Z.qZA(),Z.YNc(5,L,2,0,"th",6),Z.YNc(6,S,2,0,"th",6),Z.TgZ(7,"th",7),Z._uU(8,"Actions"),Z.qZA(),Z.qZA(),Z.qZA(),Z.TgZ(9,"tbody"),Z.YNc(10,V,8,5,"tr",8),Z.qZA(),Z.qZA()),2&t){var n=Z.oxw();Z.xp6(5),Z.Q6J("isAuth","roles.read$name"),Z.xp6(1),Z.Q6J("isAuth","roles.read$permissions"),Z.xp6(4),Z.Q6J("ngForOf",n.roles)}}var P=function(){var e=function(){function e(n,i){t(this,e),this.service=n,this.router=i}return n(e,[{key:"ngOnInit",value:function(){this.fetchList()}},{key:"delete",value:function(t){var e=this;this.service.remove(t).subscribe(function(t){return e.fetchList()})}},{key:"fetchList",value:function(){var t=this;this.service.findAll().subscribe(function(e){t.roles=e.map(function(t){return Object.assign(Object.assign({},t),{permissions:JSON.stringify(t.permissions)})})})}}]),e}();return e.\u0275fac=function(t){return new(t||e)(Z.Y36(U),Z.Y36(l.F0))},e.\u0275cmp=Z.Xpm({type:e,selectors:[["ng-component"]],decls:2,vars:2,consts:[[3,"routerLink",4,"isAuth"],["class","table table-bordered mt-3",4,"isAuth"],[3,"routerLink"],["type","submit",1,"btn","btn-primary"],[1,"table","table-bordered","mt-3"],["scope","col"],["scope","col",4,"isAuth"],["scopr","col"],[4,"ngFor","ngForOf"],[4,"isAuth"],[3,"click",4,"isAuth"],[1,"bi","bi-pencil","text-primary"],[3,"click"],[1,"bi","bi-trash","text-danger"]],template:function(t,e){1&t&&(Z.YNc(0,I,3,2,"a",0),Z.YNc(1,E,11,3,"table",1)),2&t&&(Z.Q6J("isAuth","roles.add"),Z.xp6(1),Z.Q6J("isAuth","roles.read"))},directives:[Y.h,l.yS,s.sg],encapsulation:2}),e}();function j(t,e){1&t&&(Z.TgZ(0,"div",9),Z.TgZ(1,"label",10),Z._uU(2,"Name"),Z.qZA(),Z._UZ(3,"input",11),Z.qZA())}function M(t,e){1&t&&(Z.TgZ(0,"div",9),Z.TgZ(1,"label",12),Z._uU(2,"Permissions"),Z.qZA(),Z._UZ(3,"textarea",13),Z.qZA())}var X=function(){var e=function(){function e(n,i,o){t(this,e),this.service=n,this.router=i,this.route=o,this.form=new u.cw({id:new u.NI(""),name:new u.NI("",u.kI.required),permissions:new u.NI("")})}return n(e,[{key:"ngOnInit",value:function(){var t=this,e=this.route.snapshot.paramMap.get("id");e&&this.service.findById(e).subscribe(function(n){t.form.controls.id.setValue(e),t.form.controls.name.setValue(n.name),t.form.controls.permissions.setValue(JSON.stringify(n.permissions))})}},{key:"onRemove",value:function(t){this.service.remove(t)}},{key:"onSave",value:function(){var t=this,e={name:this.form.value.name,permissions:JSON.parse(this.form.value.permissions)},n=this.form.value.id;n?this.service.update(n,e).subscribe(function(e){t.gotoList()}):this.service.save(e).subscribe(function(e){return t.gotoList()})}},{key:"reset",value:function(){this.form.reset()}},{key:"gotoList",value:function(){this.router.navigate(["/secure/settings/roles"])}}]),e}();return e.\u0275fac=function(t){return new(t||e)(Z.Y36(U),Z.Y36(l.F0),Z.Y36(l.gz))},e.\u0275cmp=Z.Xpm({type:e,selectors:[["ng-component"]],decls:14,vars:4,consts:[[1,"card"],[1,"card-body"],[1,"card-title"],[1,"row","g-3",3,"formGroup","ngSubmit"],["class","col-md-12",4,"isAuth"],[1,"text-center"],["type","submit",1,"btn","btn-primary","m-2",3,"disabled"],["type","reset",1,"btn","btn-outline-secondary","m-2",3,"click"],["type","button",1,"btn","btn-outline-secondary","m-2",3,"click"],[1,"col-md-12"],["for","title",1,"form-label"],["type","text","id","name","formControlName","name",1,"form-control"],["for","permissions",1,"form-label"],["id","permissions","formControlName","permissions",1,"form-control",2,"height","100px"]],template:function(t,e){1&t&&(Z.TgZ(0,"div",0),Z.TgZ(1,"div",1),Z.TgZ(2,"h5",2),Z._uU(3,"New Role"),Z.qZA(),Z.TgZ(4,"form",3),Z.NdJ("ngSubmit",function(){return e.onSave()}),Z.YNc(5,j,4,0,"div",4),Z.YNc(6,M,4,0,"div",4),Z.TgZ(7,"div",5),Z.TgZ(8,"button",6),Z._uU(9,"Submit"),Z.qZA(),Z.TgZ(10,"button",7),Z.NdJ("click",function(){return e.reset()}),Z._uU(11,"Reset"),Z.qZA(),Z.TgZ(12,"button",8),Z.NdJ("click",function(){return e.gotoList()}),Z._uU(13,"Cancel"),Z.qZA(),Z.qZA(),Z.qZA(),Z.qZA(),Z.qZA()),2&t&&(Z.xp6(4),Z.Q6J("formGroup",e.form),Z.xp6(1),Z.Q6J("isAuth","roles.add$name"),Z.xp6(1),Z.Q6J("isAuth","roles.add$permissions"),Z.xp6(2),Z.Q6J("disabled",!e.form.valid))},directives:[u._Y,u.JL,u.sg,Y.h,u.Fj,u.JJ,u.u],encapsulation:2}),e}(),z=o(8826),G=function(){return["../new"]};function B(t,e){1&t&&(Z.TgZ(0,"a",2),Z.TgZ(1,"button",3),Z._uU(2,"Add New"),Z.qZA(),Z.qZA()),2&t&&Z.Q6J("routerLink",Z.DdM(1,G))}function D(t,e){1&t&&(Z.TgZ(0,"th",6),Z._uU(1,"Full Name"),Z.qZA())}function H(t,e){1&t&&(Z.TgZ(0,"th",6),Z._uU(1,"Email"),Z.qZA())}function K(t,e){1&t&&(Z.TgZ(0,"th",6),Z._uU(1,"Phone"),Z.qZA())}function W(t,e){if(1&t&&(Z.TgZ(0,"td"),Z._uU(1),Z.qZA()),2&t){var n=Z.oxw().$implicit;Z.xp6(1),Z.Oqu(n.fullname)}}function tt(t,e){if(1&t&&(Z.TgZ(0,"td"),Z._uU(1),Z.qZA()),2&t){var n=Z.oxw().$implicit;Z.xp6(1),Z.Oqu(n.email)}}function et(t,e){if(1&t&&(Z.TgZ(0,"td"),Z._uU(1),Z.qZA()),2&t){var n=Z.oxw().$implicit;Z.xp6(1),Z.Oqu(n.phone)}}var nt=function(t){return["../edit",t]};function it(t,e){if(1&t&&(Z.TgZ(0,"a",2),Z._UZ(1,"i",11),Z.qZA()),2&t){var n=Z.oxw().$implicit;Z.Q6J("routerLink",Z.VKq(1,nt,n.id))}}function ot(t,e){if(1&t){var n=Z.EpF();Z.TgZ(0,"a",12),Z.NdJ("click",function(){Z.CHM(n);var t=Z.oxw().$implicit;return Z.oxw(2).delete(t.id)}),Z._UZ(1,"i",13),Z.qZA()}}function rt(t,e){if(1&t&&(Z.TgZ(0,"tr"),Z.YNc(1,W,2,1,"td",9),Z.YNc(2,tt,2,1,"td",9),Z.YNc(3,et,2,1,"td",9),Z.TgZ(4,"td"),Z._uU(5),Z.qZA(),Z.TgZ(6,"td"),Z.YNc(7,it,2,3,"a",0),Z.YNc(8,ot,2,0,"a",10),Z.qZA(),Z.qZA()),2&t){var n=e.$implicit;Z.xp6(1),Z.Q6J("isAuth","users.read$fullname"),Z.xp6(1),Z.Q6J("isAuth","users.read$email"),Z.xp6(1),Z.Q6J("isAuth","users.read$phone"),Z.xp6(2),Z.Oqu(n.role),Z.xp6(2),Z.Q6J("isAuth","users.edit"),Z.xp6(1),Z.Q6J("isAuth","users.delete")}}function st(t,e){if(1&t&&(Z.TgZ(0,"table",4),Z.TgZ(1,"thead"),Z.TgZ(2,"tr"),Z.YNc(3,D,2,0,"th",5),Z.YNc(4,H,2,0,"th",5),Z.YNc(5,K,2,0,"th",5),Z.TgZ(6,"th",6),Z._uU(7,"Role"),Z.qZA(),Z.TgZ(8,"th",7),Z._uU(9,"Actions"),Z.qZA(),Z.qZA(),Z.qZA(),Z.TgZ(10,"tbody"),Z.YNc(11,rt,9,6,"tr",8),Z.qZA(),Z.qZA()),2&t){var n=Z.oxw();Z.xp6(3),Z.Q6J("isAuth","users.read$fullname"),Z.xp6(1),Z.Q6J("isAuth","users.read$email"),Z.xp6(1),Z.Q6J("isAuth","users.read$phone"),Z.xp6(6),Z.Q6J("ngForOf",n.users)}}function ut(t,e){1&t&&(Z.TgZ(0,"div",6),Z.TgZ(1,"label",14),Z._uU(2,"Email"),Z.qZA(),Z._UZ(3,"input",15),Z.qZA())}function ct(t,e){1&t&&(Z.TgZ(0,"div",6),Z.TgZ(1,"label",16),Z._uU(2,"Password"),Z.qZA(),Z._UZ(3,"input",17),Z.qZA())}function at(t,e){1&t&&(Z.TgZ(0,"div",6),Z.TgZ(1,"label",18),Z._uU(2,"Full Name"),Z.qZA(),Z._UZ(3,"input",19),Z.qZA())}function lt(t,e){1&t&&(Z.TgZ(0,"div",6),Z.TgZ(1,"label",20),Z._uU(2,"Phone"),Z.qZA(),Z._UZ(3,"input",21),Z.qZA())}function ft(t,e){1&t&&(Z.TgZ(0,"div",6),Z.TgZ(1,"label",22),Z._uU(2,"Location"),Z.qZA(),Z._UZ(3,"input",23),Z.qZA())}function pt(t,e){if(1&t&&(Z.TgZ(0,"option",27),Z._uU(1),Z.qZA()),2&t){var n=e.$implicit;Z.Q6J("value",n.id),Z.xp6(1),Z.Oqu(n.name)}}function mt(t,e){if(1&t&&(Z.TgZ(0,"div",6),Z.TgZ(1,"label",24),Z._uU(2,"Role"),Z.qZA(),Z.TgZ(3,"select",25),Z.YNc(4,pt,2,2,"option",26),Z.qZA(),Z.qZA()),2&t){var n=Z.oxw();Z.xp6(4),Z.Q6J("ngForOf",n.roles)}}function dt(t,e){1&t&&(Z.TgZ(0,"div",10),Z.TgZ(1,"label",11),Z._uU(2,"Full Name"),Z.qZA(),Z._UZ(3,"input",12),Z.qZA())}function ht(t,e){1&t&&(Z.TgZ(0,"div",10),Z.TgZ(1,"label",13),Z._uU(2,"Email"),Z.qZA(),Z._UZ(3,"input",14),Z.qZA())}function vt(t,e){1&t&&(Z.TgZ(0,"div",10),Z.TgZ(1,"label",15),Z._uU(2,"Phone"),Z.qZA(),Z._UZ(3,"input",16),Z.qZA())}function Zt(t,e){1&t&&(Z.TgZ(0,"div",10),Z.TgZ(1,"label",17),Z._uU(2,"Location"),Z.qZA(),Z._UZ(3,"input",18),Z.qZA())}function gt(t,e){if(1&t&&(Z.TgZ(0,"option",22),Z._uU(1),Z.qZA()),2&t){var n=e.$implicit;Z.Q6J("value",n.id),Z.xp6(1),Z.Oqu(n.name)}}function At(t,e){if(1&t&&(Z.TgZ(0,"div",10),Z.TgZ(1,"label",19),Z._uU(2,"Role"),Z.qZA(),Z.TgZ(3,"select",20),Z.YNc(4,gt,2,2,"option",21),Z.qZA(),Z.qZA()),2&t){var n=Z.oxw();Z.xp6(4),Z.Q6J("ngForOf",n.roles)}}var bt=[{path:"",component:x,canActivate:[f.a],children:[{path:"users",component:w,children:[{path:"",redirectTo:"list"},{path:"list",component:function(){var e=function(){function e(n){t(this,e),this.service=n}return n(e,[{key:"ngOnInit",value:function(){this.fetchList()}},{key:"delete",value:function(t){var e=this;this.service.remove(t).subscribe(function(t){return e.fetchList()})}},{key:"fetchList",value:function(){var t=this;this.service.findAll().subscribe(function(e){t.users=e.map(function(t){return Object.assign(Object.assign({},t),{permissions:JSON.stringify(t.permissions)})})})}}]),e}();return e.\u0275fac=function(t){return new(t||e)(Z.Y36(z.f))},e.\u0275cmp=Z.Xpm({type:e,selectors:[["ng-component"]],decls:2,vars:2,consts:[[3,"routerLink",4,"isAuth"],["class","table table-bordered mt-3",4,"isAuth"],[3,"routerLink"],["type","submit",1,"btn","btn-primary"],[1,"table","table-bordered","mt-3"],["scope","col",4,"isAuth"],["scope","col"],["scopr","col"],[4,"ngFor","ngForOf"],[4,"isAuth"],[3,"click",4,"isAuth"],[1,"bi","bi-pencil","text-primary"],[3,"click"],[1,"bi","bi-trash","text-danger"]],template:function(t,e){1&t&&(Z.YNc(0,B,3,2,"a",0),Z.YNc(1,st,12,4,"table",1)),2&t&&(Z.Q6J("isAuth","users.add"),Z.xp6(1),Z.Q6J("isAuth","users.read"))},directives:[Y.h,l.yS,s.sg],encapsulation:2}),e}()},{path:"new",component:function(){var e=function(){function e(n,i,o,r){t(this,e),this.service=n,this.roleService=i,this.router=o,this.route=r,this.roles=[],this.form=new u.cw({id:new u.NI(""),roleid:new u.NI("",u.kI.required),fullname:new u.NI("",u.kI.required),email:new u.NI("",u.kI.required),password:new u.NI("",u.kI.required),confirmpassword:new u.NI("",u.kI.required),phone:new u.NI(""),location:new u.NI("")})}return n(e,[{key:"ngOnInit",value:function(){var t=this,e=this.route.snapshot.paramMap.get("id");e&&this.service.findById(e).subscribe(function(n){t.form.controls.id.setValue(e),t.form.controls.roleid.setValue(n.roleid),t.form.controls.fullname.setValue(n.fullname),t.form.controls.email.setValue(n.email),t.form.controls.password.setValue(n.password),t.form.controls.phone.setValue(n.phone),t.form.controls.location.setValue(n.location)}),this.roleService.findAll().subscribe(function(e){return t.roles=e})}},{key:"onRemove",value:function(t){this.service.remove(t)}},{key:"onSave",value:function(){var t=this,e={fullname:this.form.value.fullname,roleid:this.form.value.roleid,email:this.form.value.email,password:this.form.value.password,phone:this.form.value.phone,location:this.form.value.location},n=this.form.value.id;n?this.service.update(n,e).subscribe(function(e){return t.gotoList()}):this.service.save(e).subscribe(function(e){return t.gotoList()})}},{key:"reset",value:function(){this.form.reset()}},{key:"gotoList",value:function(){this.router.navigate(["/secure//settings/users"])}}]),e}();return e.\u0275fac=function(t){return new(t||e)(Z.Y36(z.f),Z.Y36(U),Z.Y36(l.F0),Z.Y36(l.gz))},e.\u0275cmp=Z.Xpm({type:e,selectors:[["ng-component"]],decls:25,vars:8,consts:[[1,"card"],[1,"card-body"],[1,"card-title"],[3,"formGroup","ngSubmit"],[1,"row"],["class","col-md-3",4,"isAuth"],[1,"col-md-3"],["for","confirmpassword",1,"form-label"],["type","password","id","confirmpassword","formControlName","confirmpassword",1,"form-control"],[1,"row","mt-3"],[1,"text-center"],["type","submit",1,"btn","btn-primary","m-2",3,"disabled"],["type","reset",1,"btn","btn-outline-secondary","m-2",3,"click"],["type","button",1,"btn","btn-outline-secondary","m-2",3,"click"],["for","email",1,"form-label"],["type","text","id","email","formControlName","email",1,"form-control"],["for","password",1,"form-label"],["type","password","id","password","formControlName","password",1,"form-control"],["for","fullname",1,"form-label"],["type","text","id","fullname","formControlName","fullname",1,"form-control"],["for","phone",1,"form-label"],["type","text","id","phone","formControlName","phone",1,"form-control"],["for","location",1,"form-label"],["type","text","id","location","formControlName","location",1,"form-control"],["for","role",1,"form-label"],["id","role","formControlName","roleid",1,"form-control"],[3,"value",4,"ngFor","ngForOf"],[3,"value"]],template:function(t,e){1&t&&(Z.TgZ(0,"div",0),Z.TgZ(1,"div",1),Z.TgZ(2,"h5",2),Z._uU(3,"New User"),Z.qZA(),Z.TgZ(4,"form",3),Z.NdJ("ngSubmit",function(){return e.onSave()}),Z.TgZ(5,"div",4),Z.YNc(6,ut,4,0,"div",5),Z.YNc(7,ct,4,0,"div",5),Z.TgZ(8,"div",6),Z.TgZ(9,"label",7),Z._uU(10,"Confirm Password"),Z.qZA(),Z._UZ(11,"input",8),Z.qZA(),Z.qZA(),Z.TgZ(12,"div",9),Z.YNc(13,at,4,0,"div",5),Z.YNc(14,lt,4,0,"div",5),Z.YNc(15,ft,4,0,"div",5),Z.qZA(),Z.TgZ(16,"div",9),Z.YNc(17,mt,5,1,"div",5),Z.TgZ(18,"div",10),Z.TgZ(19,"button",11),Z._uU(20,"Submit"),Z.qZA(),Z.TgZ(21,"button",12),Z.NdJ("click",function(){return e.reset()}),Z._uU(22,"Reset"),Z.qZA(),Z.TgZ(23,"button",13),Z.NdJ("click",function(){return e.gotoList()}),Z._uU(24,"Cancel"),Z.qZA(),Z.qZA(),Z.qZA(),Z.qZA(),Z.qZA(),Z.qZA()),2&t&&(Z.xp6(4),Z.Q6J("formGroup",e.form),Z.xp6(2),Z.Q6J("isAuth","users.add$email"),Z.xp6(1),Z.Q6J("isAuth","users.add$password"),Z.xp6(6),Z.Q6J("isAuth","users.add$fullname"),Z.xp6(1),Z.Q6J("isAuth","users.add$phone"),Z.xp6(1),Z.Q6J("isAuth","users.add$location"),Z.xp6(2),Z.Q6J("isAuth","users.add$role"),Z.xp6(2),Z.Q6J("disabled",!e.form.valid))},directives:[u._Y,u.JL,u.sg,Y.h,u.Fj,u.JJ,u.u,u.EJ,s.sg,u.YN,u.Kr],encapsulation:2}),e}()},{path:"edit/:id",component:function(){var e=function(){function e(n,i,o,r){t(this,e),this.service=n,this.roleService=i,this.router=o,this.route=r,this.roles=[],this.form=new u.cw({id:new u.NI(""),roleid:new u.NI("",u.kI.required),fullname:new u.NI("",u.kI.required),email:new u.NI("",u.kI.required),phone:new u.NI(""),location:new u.NI("")})}return n(e,[{key:"ngOnInit",value:function(){var t=this,e=this.route.snapshot.paramMap.get("id");e&&this.service.findById(e).subscribe(function(n){t.form.controls.id.setValue(e),t.form.controls.roleid.setValue(n.roleid),t.form.controls.fullname.setValue(n.fullname),t.form.controls.email.setValue(n.email),t.form.controls.phone.setValue(n.phone),t.form.controls.location.setValue(n.location)}),this.roleService.findAll().subscribe(function(e){return t.roles=e})}},{key:"onRemove",value:function(t){this.service.remove(t)}},{key:"onSave",value:function(){var t=this;this.service.update(this.form.value.id,{fullname:this.form.value.fullname,roleid:this.form.value.roleid,email:this.form.value.email,phone:this.form.value.phone,location:this.form.value.location}).subscribe(function(e){t.gotoList()})}},{key:"reset",value:function(){this.form.reset()}},{key:"gotoList",value:function(){this.router.navigate(["/secure/users/list"],{relativeTo:this.route})}}]),e}();return e.\u0275fac=function(t){return new(t||e)(Z.Y36(z.f),Z.Y36(U),Z.Y36(l.F0),Z.Y36(l.gz))},e.\u0275cmp=Z.Xpm({type:e,selectors:[["ng-component"]],decls:20,vars:7,consts:[[1,"pagetitle"],[1,"card"],[1,"card-body"],[1,"card-title"],[1,"row","g-3",3,"formGroup","ngSubmit"],["class","col-md-12",4,"isAuth"],[1,"text-center"],["type","submit",1,"btn","btn-primary",3,"disabled"],["type","reset",1,"btn","btn-outline-secondary",3,"click"],["type","button",1,"btn","btn-outline-secondary",3,"click"],[1,"col-md-12"],["for","fullname",1,"form-label"],["type","text","id","fullname","formControlName","fullname",1,"form-control"],["for","email",1,"form-label"],["type","text","id","email","formControlName","email",1,"form-control"],["for","phone",1,"form-label"],["type","text","id","phone","formControlName","phone",1,"form-control"],["for","location",1,"form-label"],["type","text","id","location","formControlName","location",1,"form-control"],["for","role",1,"form-label"],["id","role","formControlName","roleid",1,"form-control"],[3,"value",4,"ngFor","ngForOf"],[3,"value"]],template:function(t,e){1&t&&(Z.TgZ(0,"div",0),Z.TgZ(1,"h1"),Z._uU(2,"Users"),Z.qZA(),Z.qZA(),Z.TgZ(3,"div",1),Z.TgZ(4,"div",2),Z.TgZ(5,"h5",3),Z._uU(6,"Edit User"),Z.qZA(),Z.TgZ(7,"form",4),Z.NdJ("ngSubmit",function(){return e.onSave()}),Z.YNc(8,dt,4,0,"div",5),Z.YNc(9,ht,4,0,"div",5),Z.YNc(10,vt,4,0,"div",5),Z.YNc(11,Zt,4,0,"div",5),Z.YNc(12,At,5,1,"div",5),Z.TgZ(13,"div",6),Z.TgZ(14,"button",7),Z._uU(15,"Submit"),Z.qZA(),Z.TgZ(16,"button",8),Z.NdJ("click",function(){return e.reset()}),Z._uU(17,"Reset"),Z.qZA(),Z.TgZ(18,"button",9),Z.NdJ("click",function(){return e.gotoList()}),Z._uU(19,"Cancel"),Z.qZA(),Z.qZA(),Z.qZA(),Z.qZA(),Z.qZA()),2&t&&(Z.xp6(7),Z.Q6J("formGroup",e.form),Z.xp6(1),Z.Q6J("isAuth","users.edit$fullname"),Z.xp6(1),Z.Q6J("isAuth","users.edit$email"),Z.xp6(1),Z.Q6J("isAuth","users.edit$phone"),Z.xp6(1),Z.Q6J("isAuth","users.edit$location"),Z.xp6(1),Z.Q6J("isAuth","users.edit$role"),Z.xp6(2),Z.Q6J("disabled",!e.form.valid))},directives:[u._Y,u.JL,u.sg,Y.h,u.Fj,u.JJ,u.u,u.EJ,s.sg,u.YN,u.Kr],encapsulation:2}),e}()}]},{path:"roles",component:J,children:[{path:"",redirectTo:"list"},{path:"list",component:P},{path:"new",component:X},{path:"edit/:id",component:X}]}]}],qt=function(){var e=n(function e(){t(this,e)});return e.\u0275fac=function(t){return new(t||e)},e.\u0275mod=Z.oAB({type:e}),e.\u0275inj=Z.cJS({imports:[[l.Bz.forChild(bt),s.ez,u.UX,u.u5,c.WN,a._8,m.S,d.LU,h.L$,v.U$,p.m],l.Bz]}),e}()}}])}();