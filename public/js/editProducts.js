let domainName = 'localhost:8000';

function id(id){
	return document.getElementById(id);
}

function httpGet(url, cb){
	//If no callback is provided in the function calling, ignore the callback
	if(cb == undefined){
		cb = () => {};	
	}
	let request = new XMLHttpRequest();
	request.open('GET', url);
	request.onreadystatechange = () => {
      if(request.readyState == XMLHttpRequest.DONE && request.status >= 200 && request.status <= 300){
		return cb(request.responseText);      
      }else if(request.readyState == XMLHttpRequest.DONE){
      	return cb(null);
      }
	}	
	request.send();
}

//El estado de publicado o borrador se establece con los botones de "Guardar borrador" y "Publicar producto"
//de modo que si quieres quitar un producto publicado le das a guardar borrador.

//TODO poner los datos del producto para editarlo
function loadFullProduct(productPermalink){
	id('seccion-preview').className = 'animate-preview';
	objetoAtributos = {};
	httpGet('/api/get-single-product/'+productPermalink, (fullProduct) => {
		fullProduct = JSON.parse(fullProduct);
		id('producto-title').value = fullProduct.titulo;
		id('producto-precio').value = fullProduct.precio;
		id('permalink').value = fullProduct.permalink;
		id('producto-descripcion').value = fullProduct.descripcion;
		//Borramos los selected. Comprobamos si el <option> ya existe o no. En caso de que si, selecionalo.
		let opcionesDelSelect = document.getElementsByTagName('option');
		let anadirCategoriaOriginalProducto = true;
		for(let i = 0; i < opcionesDelSelect.length; i++){
			if(opcionesDelSelect[i].hasAttribute('selected')){
				opcionesDelSelect[i].removeAttribute('selected');
			}
		}
		for(let i = 0; i < opcionesDelSelect.length; i++){
			if(opcionesDelSelect[i].innerHTML == fullProduct.categoria){
				opcionesDelSelect[i].setAttribute("selected", "selected");
				anadirCategoriaOriginalProducto = false;
			}
		}
		if(anadirCategoriaOriginalProducto){
			id('producto-categorias').insertAdjacentHTML('afterbegin', '<option selected="selected">'+fullProduct.categoria+'</option>');
		}
		//Crear el dom de los atributos
		mostrarObjetoAtributos(fullProduct.atributos);

		//Funcion del upload.js para mostrar las imagenes en el DOM
		mostrarImagenesCliente(fullProduct.imagenes);
	});
}
//TODO this
function borrarProducto(productPermalink){
	httpGet('/api/borrar-producto/'+productPermalink, (success) => {
		if(success){
			//Funcion de upload.js
			resetAllProductData();
			id('seccion-productos').innerHTML = '';
			crearCajasProductos();
		}
	});
}

//TODO, cuando se hagan upload a las imagenes modificadas, solo subir las seleccionadas y NO toda la carpeta public-uploads porque
//se llenará de imágenes de diferentes productos conforme los vayas cargando.
//TODO, las imagenes se deforman al cambiarlas de orden.

//Funcion para crear el dom del objeto atributos pasandole el objeto.
function mostrarObjetoAtributos(objetoAtributos){
	let indexAtributo = 0;

	id('lista-atributos').innerHTML = '';

	for(let keyArrayAtributo in objetoAtributos){
		//Mostrar atributo. Función del atributo.js para crear el nodo en el DOM.
		crearNuevoAtributo(keyArrayAtributo);
		for(let i = 0; i < objetoAtributos[keyArrayAtributo].length; i++){
			//Mostrar cada valor del atributo. La funcion es del atributo.js y sirve para crear el dom de cada valor.
			insertAtributoValor(indexAtributo, objetoAtributos[keyArrayAtributo][i], keyArrayAtributo);
		}
		indexAtributo++;
	}
}
//Para generar las cajas de productos
function crearCajasProductos(){
	resetAllProductData();
	httpGet('/api/get-all-products/', (results) => {
		results = JSON.parse(results);
		if(results != false){
			let arrayProductos = results;
			for(let i = 0; i < arrayProductos.length; i++){
				let objetoProducto = arrayProductos[i];
				let tituloProducto = objetoProducto.titulo;
				let addEspacioTitulo = '';
				if(objetoProducto.titulo.length > 54){
					objetoProducto.titulo = objetoProducto.titulo.substring(0, 55);
					objetoProducto.titulo += "...";
				}else{
					addEspacioTitulo = '<br />';
				}
				let permalinkATexto = "'"+objetoProducto.permalink+"'";
				let htmlProducto = '<div class="contenedor-producto">'
					+'<img class="imagen-producto" src="../public-uploads/'+objetoProducto.imagenes[1]+'"/>'
					+'<div class="contenedor-producto-informacion"><b title="'+tituloProducto+'" style="display:inline-block;">'+objetoProducto.titulo+'</b>'
					+addEspacioTitulo+'<p class="categoria-producto-unico">'+objetoProducto.categoria+'</p>'
					+'<div class="contenedor-enlaces-producto"><a target="_blank" href="http://'+domainName+'/p/'+objetoProducto.permalink+'"> Ver </a>'
					+'<a href="javascript:void(0)" onclick="loadFullProduct('+permalinkATexto+')"> Editar </a>'
					+'<a href="javascript:void(0)" onclick="borrarProducto('+permalinkATexto+')"> Borrar </a>'
					+'</div></div><input type="hidden" value="'+objetoProducto.permalink+'"/></div>';

				id('seccion-productos').insertAdjacentHTML('beforeend', htmlProducto);
			}
		}else{
			id('seccion-productos').innerHTML = 
				'<p class="no-products-found">No hay productos para mostrar.</p>';
		}
	});
}

//Animar el seccion preview para añadir un nuevo producto
id('button-nuevo-producto').addEventListener('click', () => {
	id('seccion-preview').className = 'animate-preview';
});

crearCajasProductos();