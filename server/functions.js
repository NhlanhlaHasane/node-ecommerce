let Mongo = require('mongodb').MongoClient,
  MongoUrl = 'mongodb://merunas:jakx1234.@ds119508.mlab.com:19508/merunas-mongo',
  fs = require('fs'),
  path = require('path'),
  db = {};

Mongo.connect(MongoUrl, (err, database) => {
  if(err) console.log(err);
  db = database;
});

function buscarProducto(permalink, callback){
  console.log('BuscarProducto, functions.js');
  permalink = encodeURIComponent(permalink);
  db.collection('productos').findOne({
    'permalink': permalink
  }, {
    '_id': false
  }, (err, result) => {
    if(err){
      return callback('Error, could not find that product', null);
    }else{
      return callback(null, result);
    }
  });
};
function buscarProductos(keyword, limite, cb){
  console.log('BuscarProductos, functions.js');
  if(limite == undefined || limite == null){
    limite = 0;
  }
  limite = parseInt(limite);
  keyword = new RegExp(keyword, "g");
  db.collection('productos').find({
    'titulo': keyword
  }).limit(limite).toArray((err, results) => {
    if(err){
      return cb('Error, could not find those products', null);
    }else{
      return cb(null, results);
    }
  });
};
//Funcion para reemplazar o añadir un producto si no existe
function createUpdateProduct(permalink, productData, cb){
  console.log('CreateUpdateProduct, functions,js');
  permalink = encodeURIComponent(permalink);
  db.collection('productos').update({
    'permalink': permalink.toLowerCase()
  }, {
    'titulo': productData.titulo,
    'imagenes': productData.imagenes,
    'permalink': productData.permalink.toLowerCase(),
    'precio': productData.precio,
    'descripcion': productData.descripcion,
    'categoria': productData.categoria,
    'atributos': productData.atributos,
    'publicado': productData.publicado,
    'fecha': productData.fecha,
    'visitas': 0,
    'vendidos': 0
  }, {
    'upsert': true
  }, (err, result) => {  
    if(err){
      return cb('Error: '+err);
    }else{
      return cb(null);
    }
  });
};
//Funcion para subir las imagenes publicas al servidor en uploads
function uploadPublicImages(objectImages, permalinkName, cb){
  console.log('UploadPublicImages, functions.js');
  let publicUploads = path.join(__dirname, '../public/public-uploads/');
  let serverUploads = path.join(__dirname, '/uploads/');
  let objectImagenesSize = Object.keys(objectImages).length;
  let counter = 0;
  permalinkName = encodeURIComponent(permalinkName);
  fs.stat(path.join(serverUploads, permalinkName), (err, stats) => {
    if(err){
      fs.mkdirSync(path.join(serverUploads, permalinkName));
      copy();
    }
    else{
      //Delete the images in the folder
      fs.readdir(path.join(serverUploads, permalinkName), (err, files) => {
        if(err) console.log('Could not read the folder: '+path.join(serverUploads, permalinkName)+' to delete their images '+err);
        files.forEach((file) => {
          fs.unlink(path.join(serverUploads, permalinkName, file), (err) => {
            if(err) console.log('Could not delete the file: '+path.join(serverUploads, permalinkName, file)+' '+err);
          });
        });
        copy();
      });
    }
    function copy(){
      for(let key in objectImages){
        counter++;
        copyFile(path.join(publicUploads, objectImages[key]), path.join(serverUploads, permalinkName), objectImages[key], (err) => {
          if(err){
            return cb('Could not copy the file: '+objectImages[key]+' to the server, please try again: '+err);
          }
        });
        if(counter == objectImagenesSize){
          return cb(null);
        }
      }
    }
  });
};
//Función para conseguir todos los productos y copiar la primera imagen de cada uno al public uploads
function getAllProducts(imageLimit, page, callback){
  console.log('GetAllProducts, functions.js');
  let skipProducts = 0;
  if(page > 1){
    skipProducts = (page-1)*imageLimit;
  } 
  db.collection('productos').find({}).limit(imageLimit).skip(skipProducts).toArray((err, results) => {
    if(err){
      return callback('Err, error searching products: '+err, false);
    }
    if(results != undefined && results.length > 0){
      //Acceder a la carpeta título y copiar la 1º imagen
      copyFirstImage(results, (err) => {
        if(err) return callback(err, false);
        else return callback(null, results);
      });
    }else{
      return callback(null, false);
    }
  });
    
  function copyFirstImage(results, cb){
    let error = null;
    for(let i = 0; i<results.length; i++){
      let folderServer = path.join(__dirname, '/uploads/', results[i].permalink);
      let folderClient = path.join(__dirname, '../public/public-uploads/');
      //Comprobamos que exista el directorio
      fs.stat(folderServer, (err, stats) => {
        if(err){
          console.log('El directorio: '+folderServer+' no existe para ese producto ,'+err);
          error = 'El directorio: '+folderServer+' no existe para ese producto ,'+err;
        }else{
          fs.readdir(folderServer, (err, imagesInFolder) => {
            if(err) {
              error = 'Could not read the images in the folder. Try again.';
            }
            //Buscar la primera imagen guardada en la bd para copiarla
            for(let f = 0; f<imagesInFolder.length; f++){
              if(results[i].imagenes[1] == imagesInFolder[f]){
                let firstImageInFolder = path.join(folderServer, imagesInFolder[f]);
                copyFile(firstImageInFolder, folderClient, imagesInFolder[f], (err) => {
                  if(err){
                    error = 'Could not copy the images to the client. Try again.';
                  }
                });
              }
            }
          });
        }
      });

      if(i >= results.length - 1){
        if(error){
          cb(error);
        }else{
          cb(null);
        }
      }
    }
  };
};
function borrarProducto(permalink, cb){
  console.log('BorrarProducto, functions.js');
  permalink = encodeURIComponent(permalink);
  db.collection('productos').findOne({
    'permalink': permalink
  }, (err, result) => {
    if(err){
      return cb('Error, could not find the product to delete');
    }
    db.collection('productos').remove({
      'permalink': permalink
    }, (err, numberRemoved) => {
      if(err){
        console.log(err);
        return cb('Error, could not delete the product');
      }else{
        console.log('Se ha borrado el producto: '+permalink+ 'con exito.');
      }
      //Borramos el directorio y todas sus imagenes
      borrarDirectorio(permalink);
      return cb(null);
    });
  });
};
//Funcion para borrar el directorio y todas sus imagenes
function borrarDirectorio(permalink){
  console.log('BorrarDirectorio, functions.js');
  //El permalink ya está encoded de la funcion borrarProducto
  let imagenesServer = path.join(__dirname, '/uploads/', permalink);
  fs.readdir(imagenesServer, (err, files) => {
    let i = 0;
    if(err) console.log('Error, no se pudo leer el directorio '+imagenesServer+': '+err);
    if(files.length != null){
      files.forEach((file) => {
        fs.unlink(path.join(imagenesServer, file), (err) => {
          if(err) console.log('Error, no se pudo borrar la imagen '+path.join(imagenesServer, file)+'del servidor');
          i++;
        });
      });
      if(i >= files.length){
        fs.rmdir(imagenesServer, (err) => {
          if(err) console.log('Error, no se pudo borrar el dir '+imagenesServer+': '+err);
        });
      }
    }
  });
};
function render(page, dataObject, cb){
  console.log('Render, functions.js');
  fs.readFile(page, (err, content) => {
    if(err) throw err;
    let resultado = content.toString();
    resultado = resultado.replace(/\t*/gm, '');
    for(let propiedad in dataObject){
      let re = new RegExp("{{"+propiedad+"}}+", "gm");
      //Loop de una key
      let reItem = new RegExp("{{loop "+propiedad+" [^-]+}}" ,"gm");
      //Empieza el loop por el key indicado
      let reTotalItem = new RegExp("{{loop "+propiedad+" -.*-}}" ,"gm");
      let reTotal = new RegExp("{{loop "+propiedad+"}}" ,"gm");
      let reLoopKey = new RegExp("{{loopKey "+propiedad+"}}", "gm");

      if(re.test(resultado)){
        resultado = resultado.replace(re, dataObject[propiedad]);
      }

      if(reItem.test(resultado)){
        let loopObject = dataObject[propiedad];
        for(let key in loopObject){
          let reItemFind = new RegExp("{{loop "+propiedad+" [^-]?"+key+"[^-]?}}" ,"gm");
          resultado = resultado.replace(reItemFind, loopObject[key]);  
        }
      }

      if(reLoopKey.test(resultado)){
        let loopObject = dataObject[propiedad];
        let reKeyWithTagsBig = new RegExp("^(.*){{loopKey "+propiedad+"}}(.*)([\\s\\S]*){{\\/loopKey "+propiedad+"}}.*$", "gm");
        let reArrayWithTags = new RegExp("^([\\s\\S]*)\n(.*){{loopArray "+propiedad+"}}(.*)([\\s\\S]*)$", "gm");
        let matchKeyBig;
        let matchArray; 
        let textoFinal = "";
        matchKeyBig = reKeyWithTagsBig.exec(resultado);
        matchArray = reArrayWithTags.exec(matchKeyBig[3]);
        for(let key in loopObject){
          textoFinal += matchKeyBig[1]+key+matchKeyBig[2]+'\n';
          //Lo que hay antes del <option> es matcharray[1]
          textoFinal += matchArray[1];
          for(let i = 0; i<loopObject[key].length; i++){
            let itemArray = matchArray[2]+loopObject[key][i]+matchArray[3]+"\n";
            textoFinal += itemArray;
          }
          //Lo que hay despues del <option> es matcharray[4]
          textoFinal += matchArray[4];
        }
        resultado = resultado.replace(reKeyWithTagsBig, textoFinal);
        textoFinal = "";
      }

      if(reTotalItem.test(resultado)){
        let loopObject = dataObject[propiedad];
        let reTotalWithTags = new RegExp("^(.*){{loop "+propiedad+" -(.*)-}}(.*)$" ,"gm");
        let match = reTotalWithTags.exec(resultado);
        let textoFinal = "";
        let doneWaiting = false;
        for(let key in loopObject){
          //en match[2] se encuentra la key por la que empezar 
          if(key == match[2] || doneWaiting){
            doneWaiting = true;
            if(match != null && loopObject[key] != undefined) textoFinal += match[1]+loopObject[key]+match[3]+"\n";
          }
        }
        resultado = resultado.replace(reTotalWithTags, textoFinal);
        textoFinal = "";
      }

      if(reTotal.test(resultado)){
        let loopObject = dataObject[propiedad];
        reTotal = new RegExp("^(.*){{loop "+propiedad+"}}(.*)$" ,"gm");
        let match = reTotal.exec(resultado);
        let textoFinal = "";
        for(let key in loopObject){
          if(match != null && loopObject[key] != undefined) textoFinal += match[1]+loopObject[key]+match[2]+"\n";
        }
        resultado = resultado.replace(reTotal, textoFinal);
        textoFinal = "";
      } 
    }
    return cb(null, resultado);
  });
};
//Origin es el archivo con path y end es solo directorio sin nombre de archivo
function copyFile(origin, end, fileName, callback){
  console.log('CopyFile, functions.js');
  let callbackCalled = false;
  let readStream = fs.createReadStream(origin);
  readStream.on('error', (err) => {
    console.log(err);
    done(err);
  });
  let finalName = path.join(end, fileName);
  let writeStream = fs.createWriteStream(finalName);
  writeStream.on('error', (err) => {
    console.log(err);
    done(err);
  });
  writeStream.on('close', (ex) => {
    done();
  });
  readStream.pipe(writeStream);

  function done(err){
    if(!callbackCalled){
      return callback(err);
      callbackCalled = true;
    }
  }
};
//Para guardar las categorías
function guardarCategorias(categorias, callback){
  console.log('GuardarCategorias, functions.js');
  //1º Buscamos el array
  //2º Lo actualizamos, categorias es un param de la funcion
  //3º Si no existe, crear uno nuevo
  //4º Callback
  db.collection('categorias').update({
    'arrayCategorias': {$exists : true}
  }, {
    'arrayCategorias': categorias
  }, {
    'upsert': true
  }, (err, countFilesModified, result) => {    
    if(err){
      return callback('Error, could not update categories', null);
    }else{
      return callback(null, 'Categories saved correctly');
    }
  });
};
function getCategories(callback){
  console.log('GetCategories, functions.js');
  db.collection('categorias').findOne({
    'arrayCategorias': {$exists : true}
  }, (err, result) => {    
    if(err){
      return callback('Err, could not find the categories.', null);
    }else{
      return callback(null, result);
    }
  });
};
function copyDirectory(origin, end, callback){
  console.log('CopyDirectory, functions.js');
  if(callback == undefined){
    callback = () => {};
  }
  let callbackCalled = false;
  fs.stat(origin, (err, stats) => {
    if(err) done(err);
    if(stats.isDirectory()){
      //Check if end exists and create directory
      fs.stat(end, (err, stats) => {
        if(err){
          fs.mkdir(end, (err) => {
            if(err){
              console.log(err);
            }
          });
        }
      });
      //Copy the files from origin to end
      fs.readdir(origin, (err, files) => {
        if(err){
          done(err);
        }else if(files.length > 0){
          files.forEach((file) => {
            copyFile(path.join(origin, file), end, file, (err) => {
              if(err){
                done(err);
              }else{
                done(null);
              }
            });
          });
        }else{
          done('Error copying images, there are no files to be copied');
        }
      });
    }else{
      done('Error copying images, your origin is not a directory');
    }
  });

  function done(err){
    if(!callbackCalled){
      callback(err);
      callbackCalled = true;
    }
  }
};
function guardarBusqueda(busqueda, cb){
  console.log('GuardarBusqueda, functions.js');
  if(busqueda){
    db.collection('busquedas').findOne({
      'search': busqueda
    }, (err, busquedaExistente) => {
      if(err){        
        return cb('Error searching busquedas');
      }else{
        if(!busquedaExistente){
          busquedaExistente = {};
          busquedaExistente.veces = 0;
        }
        //Para actualizar o crear un nuevo registro
        db.collection('busquedas').update({
          'search': busqueda
        }, {
          'search': busqueda,
          'veces': (busquedaExistente.veces + 1)
        }, {
          'upsert': true
        }, (err, result) => {          
          if(err) return cb('Err, could not save the search in the database');
          return cb(null);
        });
      }
    });
  }
};
//Para guardar imagenes en el servidor y base de datos
function guardarSliderImages(objectImages, cb){
  console.log('GuardarSliderImages, functions.js');
  let origin = path.join(__dirname, '../public/public-uploads/');
  let end = path.join(__dirname, '/uploads/Slider/');
  let tamañoObjectImages = Object.keys(objectImages).length;

  borrarSliderFolder((err) => {
    if(err) return cb(err);
    for(let key in objectImages){
      let fileLocation = path.join(origin, objectImages[key]);
      copyFile(fileLocation, end, objectImages[key], (err) => {
        if(err){
          console.log(err);
          return cb('Err, could not copy the image: '+objectImages[key]+' to the server /Slider/: '+err);
        }
      });
    }
    db.collection('utils').update({
      'sliderImages': {$exists: true}
    }, {
      'sliderImages': objectImages
    }, {
      'upsert': true
    }, (err, countFilesModified, result) => {      
      if(err) return cb('Err, could not save the slider images to the db: '+err);
      else{
        console.log('Done without errors');
        return cb(null);
      }
    });
  });

  //Para borrar cada imagen en el Slider si las hubiera y crear el folder si no existiera
  function borrarSliderFolder(cb){
    fs.stat(end, (err, stats) => {
      //Si el directorio no existe, lo creamos y terminamos
      if(err){
        fs.mkdir(end, (err) => {
          if(err) cb(err);
          else return cb(null);
        });
      //Sino, borramos su contenido si lo hubiera
      }else{
        fs.readdir(end, (err, files) => {
          if(err) return cb(err);
          //Si no está vacio el directorio borrar cada imagen
          if(files.length != 0){
            for(let i = 0; i < files.length; i++){
              fs.unlink(path.join(end, files[i]), (err) => {
                if(err) return cb(err);
                if(i >= files.length-1){
                  return cb(null);
                }
              });
            }
          }else{
            return cb(null);
          }
        });
      }
    });
  }
};
//Para copiar las imagenes del slider al cliente y retornar el objeto imagenes
function getSlider(cb){
  console.log('GetSlider, functions.js');
  db.collection('utils').findOne({
    'sliderImages': {$exists: true}
  }, (err, result) => {    
    if(err) return cb('Error searching slider images: '+err, null);
    let images = result.sliderImages;
    let originDir = path.join(__dirname, '/uploads/_Slider/');
    let end = path.join(__dirname, '../public/public-uploads/');
    for(let key in images){
      copyFile(path.join(originDir, images[key]), end, images[key], (err) => {
        if(err) return cb('Error copying the slider images to the client '+err, null);
      });
      if(key >= Object.keys(images).length){
        //Si se han copiado todas las imágenes con exito
        return cb(null, images);
      }
    }
  });
};
//Para conseguir los 5 productos más vendidos para el minislider //Visitas //Vendidos
function getMiniSlider(tipo, cb){
  console.log('GetMasVendidos, functions.js');
  db.collection('productos').find({}, {
    "_id": false,
    "titulo": true,
    "permalink": true,
    "precio": true,
    "imagenes": true,
    "categoria": true
  }).sort({
    tipo: -1
  }).limit(5).toArray((err, results) => {
    if(err) return cb('Error searching products, '+err, null);
    let origin = path.join(__dirname, '/uploads/');
    let end = path.join(__dirname, '../public/public-uploads');
    for(let i = 0; i < results.length; i++){
      copyFile(path.join(origin, results[i].permalink, results[i].imagenes[1]), end, results[i].imagenes[1], (err) => {
        if(err) return cb('Err, could not copy the image '+results[i].imagenes[1]+' to the client, '+err, null);
      });
      if(i >= results.length-1){
        return cb(null, results);
      }
    }
  });
};
//Function que me dice cuantas páginas hay en total para ese límite de productos por página.
function getPaginacion(limite, cb){
  console.log('GetPaginacion, functions.js');
  db.collection('productos').count((err, count) => {
    if(err){
      console.log(err);
      return cb('Error calculando la paginación de los productos. Intentalo de nuevo.', null);
    }
    //Las páginas totales incluida la última que puede ser menor del límite.
    let paginas = Math.ceil(count/limite);
    return cb(null, paginas);
  });
}; 

exports.buscarProducto = buscarProducto;
exports.render = render;
exports.copyFile = copyFile;
exports.copyDirectory = copyDirectory;
exports.guardarCategorias = guardarCategorias;
exports.getCategories = getCategories;
exports.getAllProducts = getAllProducts;
exports.borrarProducto = borrarProducto;
exports.createUpdateProduct = createUpdateProduct;
exports.uploadPublicImages = uploadPublicImages;
exports.borrarDirectorio = borrarDirectorio;
exports.buscarProductos = buscarProductos;
exports.guardarBusqueda = guardarBusqueda;
exports.guardarSliderImages = guardarSliderImages;
exports.getSlider = getSlider;
exports.getMiniSlider = getMiniSlider;
exports.getPaginacion = getPaginacion;