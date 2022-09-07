(function(){
    //Definiendo la zona principal de dibujo
    var canvas = document.querySelector('#paint');
    var ctx = canvas.getContext('2d');

    //Estableciendo las dimenciones del área principal
    var areaForPaint = document.querySelector('#areaForPaint');
    var areaForPaintStyle = getComputedStyle(areaForPaint);
    canvas.width = parseInt(areaForPaintStyle.getPropertyValue('width'));
    canvas.height = parseInt(areaForPaintStyle.getPropertyValue('height'));

    //Para mostrar que linea vamos a dibujar
    var canvasSmall = document.getElementById('brushSize');
    var contextSmall = canvasSmall.getContext('2d');
    var centerX = canvasSmall.width / 2;
    var centerY = canvasSmall.height / 2;
    var radius;

    // Creando un área de dibujo temporal desde la que transferimos los objetos
    var tmpCanvas = document.createElement('canvas');
    var tmpCtx = tmpCanvas.getContext('2d');
    tmpCanvas.id ='tmpCanvas';
    //Ancho y alto para la unidad principal
    tmpCanvas.width = canvas.width;
    tmpCanvas.height = canvas.height;
    //Añadir al DOM
    areaForPaint.appendChild(tmpCanvas);

    //Área de texto
    var textArea = document.createElement('textarea');
    textArea.id = 'textTool';
    areaForPaint.appendChild(textArea);

    //Contenedor de texto auxiliar
    //tendrá líneas/símbolos
    var tmpTxtCtn = document.createElement('div');
    tmpTxtCtn.style.display = 'none';
    areaForPaint.appendChild(tmpTxtCtn);

    //Variable auxiliares y matrices

    //Definir un objeto ratón con coordenadas X,Y
    var mouse = {
        x : 0,
        y : 0
    };
    var StartMouse = {
        x : 0,
        y : 0
    };
    //Buffering
    var imgData;
    var imgCopyRand;
    var imgCopyRandMain;

    //Matriz de punto para dibujar la línea
    var ppts = [];

    //Matriz en la que se almacenan los elementos (utilizada para "Deshacer" y "Volver")
    var undoArr = [];
    var undoCount = 0;
    var emptyCanv;

    // Copiar un área
    var xCopy;
    var yCopy;
    var xForCopy;
    var yForCopy;
    var whatPaste;

    //Guardar informacion sobre la lina actual
    var lastWidth;
    var lastColor;
    var lastAlpha;

    //Establecer el color de relleno
    var r , g, b;

    //Color de relleno transparencia
    var alpha;

    // Tomar los parametros del HTML

    //Herramienta actual por defecto
    let tool = "brush";

    /**
     * guardamos la herramienta seleccionada en una variable
     */
    let buttons = [...document.querySelectorAll( '#tools button' )];
        buttons.map( btn => {
            btn.addEventListener( 'click', () => {
                tool = btn.getAttribute('id');
                //console.log("tools = ", tool);
        } );
    } );

    //Ajuste del tamaño y tipo de letra

    document.getElementById('textSize').addEventListener('change',function(){
        var size = document.getElementById('textSize').value;
        document.getElementById('textTool').style.fontSize = parseInt(size) + 'px';
    });
    document.getElementById('font').addEventListener('change',function(){
        var font = document.getElementById('font');
        var fontStraa = font.options[font.selectedIndex].text;
        //console.log(fontStraa);
        document.getElementById("textTool").style.fontFamily = fontStraa;
    });

    /**
     * El otro jquery
     */

    //Ajuste del color
    document.getElementById('color').addEventListener("change", function(){
        tmpCtx.strokeStyle = document.getElementById("color").value;
        r = hexToRgb(tmpCtx.strokeStyle).r;
        g = hexToRgb(tmpCtx.strokeStyle).g;
        b = hexToRgb(tmpCtx.strokeStyle).b;
        tmpCtx.fillStyle = tmpCtx.strokeStyle;
        //console.log("color = ", tmpCtx.strokeStyle);
        //dibujar una linea de ejemplo
        drawBrush();
    });

    var hexToRgb = function(hex){
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1],16),
            g: parseInt(result[2],16),
            b: parseInt(result[3], 16)
        } : null;
    };

    //Al seleccionar un grosor de linea dibuja una nueva
    document.getElementById('widthRange').addEventListener('change',function(){
        tmpCtx.lineWidth = document.getElementById('widthRange').value / 2;
        drawBrush();
    });

    //Cuando se seleccione la tarnsparencia de la linea
    document.getElementById('opacityRange').addEventListener('change',function(){
        tmpCtx.globalAlpha  = document.getElementById('opacityRange').value / 100;
        alpha = Math.round(tmpCtx.globalAlpha  * 255);
        drawBrush();
    });

    //Limpiar el área
    document.getElementById('clear').addEventListener('click', function(){
        ctx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    });

    /**
     * Terminar de configurar los ajustes de HTML
     */

    //Ejemplo de linea
    var drawBrush = function(){
        contextSmall.clearRect(0, 0, canvasSmall.width, canvasSmall.height);
        radius = tmpCtx.lineWidth;
        radius = radius/2;

        contextSmall.beginPath();
        contextSmall.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
        contextSmall.fillStyle = tmpCtx.strokeStyle;
        contextSmall.globalAlpha  = tmpCtx.globalAlpha ;
        contextSmall.fill();
    }

    /**
     * Valores por defecto
     */

    //Grosor de la linea
    tmpCtx.lineWidth = document.getElementById("widthRange").value / 2;

    //valores por defecto
    tmpCtx.lineJoin = 'round';
    tmpCtx.lineCap = 'round';
    tmpCtx.strokeStyle = 'black';
    tmpCtx.fillStyle = 'black';
    r = 0;
    g = 0;
    b = 0;
    alpha = 255;

    drawBrush();

    //Colocar un área vacia en la matriz de deshacer
    emptyCanv = canvas.toDataURL();
    undoArr.push(emptyCanv);

    //establecer las coordenadas del raón en las areas pricipal y auxiliar
    tmpCanvas.addEventListener('mousemove', function(e){
        mouse.x = typeof e.offsetX !== 'undefined' ? e.offsetX : e.layerX;
        mouse.y = typeof e.offsetY !== 'undefined' ? e.offsetY : e.layerY;
    }, false);

    tmpCanvas.addEventListener('mousedown',function(e) {
        tmpCanvas.addEventListener('mousemove', onPaint, false);
        if(tool == "text"){
            var lines = textArea.value.split('\n');
            var processedLines = [];

            for(var i = 0; i < lines.length; i++){
                var chars = lines[i].length;
                for (var j = 0; j< chars; j++){
                    var textNode = document.createTextNode(lines[i][j]);
                    tmpTxtCtn.appendChild(textNode);
                    /**
                     *  Dado que tmpTxtCtn no ocupa espacio
                     *  en el diseño debido al display none, tenemos que
                     *  hacer que ocupe un espacio mientas se mantiene
                     *  oculto y luego optener las dimensiones
                     */
                    tmpTxtCtn.style.position = 'absolute';
                    tmpTxtCtn.style.visibility = 'hiden';
                    tmpTxtCtn.style.display = 'block';

                    var width = tmpTxtCtn.offsetWidth;

                    tmpTxtCtn.style.position = '';
                    tmpTxtCtn.style.visibility = '';
                    tmpTxtCtn.style.display= 'none';

                    if(width >parseInt(textArea.style.width)){
                        break
                    }
                }
                processedLines.push(tmpTxtCtn.textContent);
                tmpTxtCtn.innerHTML = '';
            }
            var taCompStyle = getComputedStyle(textArea);
            var fs = taCompStyle.getPropertyValue('font-size');
            var ff = taCompStyle.getPropertyValue('font-family');
            tmpCtx.font = fs + ' ' + ff;
            tmpCtx.textBaseline = 'top';
            for(var n=0; n<processedLines.length; n++){
                var processedLine = processedLines[n];

                tmpCtx.fillText(
                    processedLine,
                    parseInt(textArea.style.left),
                    parseInt(textArea.style.top)+ n * parseInt(fs)
                );
            }
            textArea.style.display ='none';
            textArea.value='';
        }

        mouse.x = typeof e.offsetX !== 'undefined' ? e.offsetX : e.layerX;
        mouse.y = typeof e.offsetY !== 'undefined' ? e.offsetY : e.layerY;

        //si se selecciona Pegar, haga clic para insertar la imagen
        if((tool=="copy") || (tool=="copyrand")){
            lastColor = tmpCtx.strokeStyle;
            lastWidth = tmpCtx.lineWidth;
            lastAlpha = tmpCtx.globalAlpha;
        }
        StartMouse.x = mouse.x
        StartMouse.y = mouse.y
        ppts.push({x: mouse.x, y: mouse.y});

    }, false);

    //Cuando suelte el ratón deje de mover el área de texto
    textArea.addEventListener('mouseup',function(){
        tmpCanvas.removeEventListener('mousemove', onPaint,false);
    });

    tmpCanvas.addEventListener('mouseup', function(){
        tmpCanvas.removeEventListener('mousemove', onPaint,false);
        if(tool=="fill"){
            onPaint();
        }
        if(tool=="paste"){
            if(whatPaste == 2){
                //crea un temporal para no sobre escribir en el original
                var imgCopyRandDop = ctx.createImageData(imgCopyRand);
                imgCopyRandDop.data.set(imgCopyRand.data);
                pasteRand(imgCopyRandDop);
            }else{
                ctx.putImageData(imgData, mouse.x, mouse.y);
            }
        }

        // Cancelar la acción de borrado
        ctx.globalCompositeOperation = 'source-over';

        //Dibujar en un lienzo real
        if(tool == "copy"){
            tmpCtx.setLineDash([0,0]);
            tmpCtx.strokeStyle = lastColor;
            tmpCtx.lineWidth = lastWidth;
            tmpCtx.globalAlpha = lastAlpha;
        }

        //Borrar el linezo temporal
        if(tool= "copyrand"){
            tmpCtx.beginPath();
            tmpCtx.moveTo(StartMouse.x, StartMouse.y);
            tmpCtx.lineTo(xCopy, yCopy);
            tmpCtx.stroke();
            tmpCtx.closePath();
            imgCopyRand = tmpCtx.getImageData(0,0,tmpCanvas.width, tmpCanvas.height);
            imgCopyRandMain = ctx.getImageData(0,0,tmpCanvas.width, tmpCanvas.height);
            whatPaste = 2;
            tmpCtx.strokeStyle = lastColor;
            tmpCtx.lineWidth = lineWidth;
            tmpCtx.globalAlpha = lastAlpha;
        }else if(tool == "no"){
            xForCopy = StartMouse.x;
            yForCopy = StartMouse.y;
            tool = "copyrand";
        }

        if(tool != "copyrand" && tool != "copy" && tool != "no"){
            ctx.drawImage(tmpCanvas, 0,0);
        }

        tmpCtx.clearRect(0,0,tmpCanvas.width,tmpCanvas.height);
        //Limpiamos los pinceles
        ppts = [];

        //poner una matriz para cancelar
        undoArr.push(canvas.toDataURL());
        undoCount = 0;

    }, false);

    //Guradar la imagen
    //Llamada a la funcion de carga
    var callDownload = function() {
        download (paint, 'myPicture.png')
    };

    // Llamar a la funcion cuando se pulsa el boton
    document.getElementById("idDownload").addEventListener("click",callDownload);

    //Descargar
    function download(canvas, filename) {

        //Crea un falso canvas

        //Crea una etiqueta de anclaje fuera de la pantalla
        var lnk = document.createElement('a')
            ,e;

        //establecemos el atributo download de la etiqueta a

        lnk.download = filename;

        /**
         *  Convertir el el contenido del cavas en data-uri para el enlace.
         *  Cuando se establece el atributo de descarga,
         *  el contenido apuntado por el enlace será empujado como "descarga" en los navegadores
         */
        lnk.href = canvas.toDataURL();

        //Crea un evento de click falso para activar la descarga
        if(document.createEvent){
            e = new MouseEvent("click",{});
            lnk.dispatchEvent(e);
        }else if(lnk.fireEvent){
            lnk.fireEvent("onclick");
        }

    }

    //Operacion de anulación y retorno
    //Cancelar

    document.getElementById("undo").addEventListener("click",function(){
        if(undoArr.length > 1){
            if(undoCount + 1 < undoArr.length){
                if(undoCount + 2 == undoArr.length){
                    if(confirm("¿Realmente quieres cancelar?")){
                        undoCount++;
                        UndoFunc(undoCount);
                    }
                }else{
                    undoCount++;
                    UndoFunc(undoCount);
                }
                if(undoCount +1 == undoArr.length){
                    undoCount = 0;
                    undoArr = [];
                    undoArr.push(emptyCanv);
                }
            }
        }
    });

    //Volver
    document.getElementById("redo").addEventListener("click", function(){
        if(undoCount > 0){
            undoCount--;
            UndoFunc(undoCount);
        }
    });

    var UndoFunc = function(count){
        var number = undoArr.length;
        var img_data = undoArr[number - (count + 1)];
        var undoImg = new Image();

        ctx.clearRect(0,0,tmpCanvas.width, tmpCanvas.height);
        ctx.drawImage(undoImg,0,0);
    };

    //Dibujo de los elementos
    //Dibujar con lapiz

    var onPaintBrush = function(){

        //Despeje la linea de tiempo antes de dibujar
        tmpCtx.clearRect(0,0,tmpCanvas.width,tmpCanvas.height);

        //Guardar todas las coordenadas en un array
        ppts.push({x:mouse.x, y:mouse.y});

        if (ppts.length < 3){
            var m = ppts[0];
            tmpCtx.beginPath();
            tmpCtx.arc(m.x, m.y, tmpCtx.lineWidth/2, 0, Math.PI *2, !0);
            tmpCtx.fill();
            tmpCtx.closePath();

            return;
        }

        //Despeja siempre la linea de tiempo antes de dibujar
        tmpCtx.clearRect(0,0,tmpCanvas.width,tmpCanvas.height);

        tmpCtx.beginPath();
        tmpCtx.moveTo(ppts[0].x, ppts[0].y);

        for(var i=1; i< ppts.length - 2; i++){
            var c = (ppts[i].x + ppts[i+1].x)/2;
            var d = (ppts[i].y + ppts[i+1].y)/2;

            tmpCtx.quadraticCurveTo(ppts[i].x, ppts[i].y, c,d)
        }

        //Para los ultimos puntos
        tmpCtx.quadraticCurveTo(
            ppts[i].x,
            ppts[i].y,
            ppts[i+1].x,
            ppts[i+1].y
        );
        tmpCtx.stroke();
        tmpCtx.closePath();
    };

    //Dibujar un circulo
    var onPaintCircle = function(){

        //Despeje la linea de tiempo antes de dibujar
        tmpCtx.clearRect(0,0,tmpCanvas.width, tmpCanvas.height);

        var x = (mouse.x + StartMouse.x)/2;
        var y = (mouse.y + StartMouse.y)/2;

        var radius = Math.max(
            Math.abs(mouse.x - StartMouse.x),
            Math.abs(mouse.y - StartMouse.y)
        )/2;

        tmpCtx.beginPath();
        tmpCtx.arc(x,y,radius,0, Math.PI*2, false);
        tmpCtx.stroke();
        tmpCtx,closePath();
    };

    //Dibujar una linea recta
    var onPaintLine = function(){

        //Despeje la linea de tiempo antes de dibujar
        tmpCtx.clearRect(0,0,tmpCanvas.width, tmpCanvas.height);

        tmpCtx.beginPath();
        tmpCtx.moveTo(StartMouse.x, StartMouse.y);
        tmpCtx.lineTo(mouse.x, mouse.y);
        tmpCtx.stroke();
        tmpCtx.closePath();
    };

    //Dibujar un rectangulo
    var onPaintRect = function(){
        //Despeje la linea de tiempo antes de dibujar
        tmpCtx.clearRect(0,0,tmpCanvas.width, tmpCanvas.height);

        var x = Math.min(mouse.x, StartMouse.x);
        var y = Math.min(mouse.y, StartMouse.y);
        var width = Math.abs(mouse.x - StartMouse.x);
        var height = Math.abs(mouse.y - StartMouse.y);
        tmpCtx.strokeRect(x,y,width,height);
    };

    //Dibujar una elipse
    function drawEllipse(ctx){

        tmpCtx.clearRect(0,0,tmpCanvas.width, tmpCanvas.height);

        var x = Math.min(mouse.x, StartMouse.x);
        var y = Math.min(mouse.y, StartMouse.y);

        var w = Math.abs(mouse.x - StartMouse.x);
        var h = Math.abs(mouse.y - StartMouse.y);

        var kappa = 0.5522848,
            ox = (w/2) * kappa, //Punto de desplazamiento horizontal
            oy = (h/2) * kappa, //Punto de desplazamiento vertical
            xe = x+w,           //x final
            ye = y+h,           //y final
            xm = x+w/2,         //x medio
            ym = y+h/2;         //y medio

        ctx.beginPath();
        ctx.moveTo(x, ym);
        ctx.bezierCurveTo(x, ym-oy, xm-ox, y, xm, y);
        ctx.bezierCurveTo(xm+ox, y, xe, ym-oy, xe, ym);
        ctx.bezierCurveTo(xe, ym+oy, xm+ox, ye, xm, ye);
        ctx.bezierCurveTo(xm-ox, ye, x, ym+oy, x, ym);
        //ctx.stroke();
        ctx.closePath();
    };

    //Borrador
    var onErase = function(){

        //Guarda los puntos en una matriz
        ppts.push({x: mouse.x, y: mouse.y});

        ctx.globalCompositeOperation =  'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.strokeStyle = 'rgba(0,0,0,0)';
        ctx.lineWidth = tmpCtx.lineWidth;

        if(ppts.length < 3){
            var w = ppts[0];
            ctx.beginPath();
            ctx.arc(w.x, w.y,ctx.lineWidth/2,0,Math.PI*2,!0)
            ctx.fill();
            ctx.closePath();

            return;
        }

        ctx.beginPath();
        ctx.moveTo(ppts[0].x, ppts[0].y);

        for(var i =1; i<ppts.length-2; i++){
            var c = (ppts[i].x + ppts[i+1].x)/2;
            var d = (ppts[i].y + ppts[i+1].y)/2;
            ctx.quadraticCurveTo(ppts[i].x, ppts[i].y,c,d);
        }

        //Para los dos ultimos puntos
        ctx.quadraticCurveTo(
            ppts[i].x,
            ppts[i].y,
            ppts[i+1].x,
            ppts[i+1].y
        );
        ctx.stroke();
    };

    //Spray
    var getRandomOffset = function(radius){
        var randomAngle = Math.random()*(2*Math.PI);
        var randomRadius = Math.random()*radius;

        return{
            x: Math.cos(randomAngle) * randomRadius,
            y: Math.sin(randomAngle) * randomRadius
        };
    };

    var generateSprayParticles = function(){

        //cantidad de particulas o densidad
        var density = tmpCtx.lineWidth * 2;

        for(var i = 0; i < density; i++){
            var offset = getRandomOffset(tmpCtx.lineWidth);

            var x = mouse.x + offset.x;
            var y = mouse.y + offset.y;

            tmpCtx.fillRect(x,y,1,1);
        }
    };

    //Copiar
    var onCopy = function(){
        //Despeje la linea de tiempo antes de dibujar
        tmpCtx.clearRect(0,0,tmpCanvas.width,tmpCanvas.height);

        tmpCtx.globalAlpha = 1;
        tmpCtx.strokeStyle = 'black';
        tmpCtx.lineWidth = 2;
        tmpCtx.setLineDash([3, 15]);
        var x = Math.min(mouse.x, StartMouse.x);
        var y = Math.min(mouse.y, StartMouse.y);
        var width = Math.abs(mouse.x - StartMouse.x)+1;
        var height = Math.abs(mouse.y - StartMouse.y)+1;
        tmpCtx.strokeRect(x, y, width, height);
        imgData = ctx.getImageData(x, y, width, height);
        whatPaste = 1;
    };

    //Dibujo de texto
    var onText = function(){
        //Despeje la linea de tiempo antes de dibujar
        tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);

        var x = Math.min(mouse.x, StartMouse.x);
        var y = Math.min(mouse.y, StartMouse.y);
        var width = Math.abs(mouse.x - StartMouse.x);
        var height = Math.abs(mouse.y - StartMouse.y);

        textArea.style.left = x + 'px';
        textArea.style.top = y + 'px';
        textArea.style.width = width + 'px';
        textArea.style.height = height + 'px';

        textArea.style.display= 'block';
    };

    //Verter
    var onFill = function(opacityAlpha){
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var width = imageData.width;
        var height = imageData.height;
        var stack = [[StartMouse.x, StartMouse.y]];
        var pixel = 0;
        var point = 0;

        while(stack.length > 0){
            pixel = stack.pop();

            if(pixel[0] < 0 || pixel[0] >= width)
                continue;
            if(pixel[1] < 0 || pixel[1] >= height)
                continue;

            //Alpha
            point = pixel[1] * 4 * width + pixel[0] * 4 + 3;

            //Si no es un marcho u no ha sido pintado
            if(imageData.data[point] != opacityAlpha && imageData.data[point] != 255 && (imageData.data[point] > 255 || imageData.data[point] <5)){
                //Pintura
                imageData.data[point] = opacityAlpha
                imageData.data[point - 3] = r; //Red
                imageData.data[point - 2] = g; //Green
                imageData.data[point - 1] = b; //Blue

                //Poner en la pila para comprobar

                stack.push([
                    pixel[0]-1,
                    pixel[1]
                ]);
                stack.push([
                    pixel[0]+1,
                    pixel[1]
                ]);
                stack.push([
                    pixel[0],
                    pixel[1]-1,
                ]);
                stack.push([
                    pixel[0],
                    pixel[1] +1
                ]);
            }
        }
        ctx.putImageData(imageData, 0, 0);
    };

    var oncopyRand = function(){
        //Guarda las coordenadas en un array
        ppts.push({x:mouse.x, y:mouse.y});
        tmpCtx.globalAlpha = 1;
        tmpCtx.strokeStyle = 'black';
        tmpCtx.lineWidth = 2;
        if(ppts.length < 3){
            var m = ppts[0];
            tmpCtx.beginPath();
            tmpCtx.arc(m.x, m.y, tmp.lineWidth/2, 0, Math.PI*2, !0);
            tmpCtx.fill();
            tmpCtx.closePath();

            return;
        }

        //Despeje la linea de tiempo antes de dibujar
        tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);

        tmpCtx.beginPath();
        tmpCtx.moveTo(ppts[0].x, ppts[0].y);

        for(var i = 1; i < ppts.length - 2; i++){
            var c = (ppts[i].x + ppts[i+1].x) / 2;
            var d = (ppts[i].y + ppts[i+1].y) / 2;

            tmpCtx.quadraticCurveTo(ppts[i].x, ppts[i].y, c,d);
        }

        //Para los dos ultimos puntos
        tmpCtx.quadraticCurveTo(
            ppts[i].x,
            ppts[i].y,
            ppts[i+1].x,
            ppts[i+1].y
        );
        tmpCtx.stroke();
        xCopy = ppts[i + 1].x;
        yCopy = ppts[i + 1].y;

    };

    var pasteRand = function(imgdataRand){
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var width = imageData.width;
        var height = imageData.height;
        var stack = [[xForCopy, yForCopy]];
        var dx =  xForCopy - mouse.x;
        var dy = yForCopy - mouse.y;
        var point2 = yForCopy * 4 * width + xForCopy * 4 + 3;
        var pixel;
        var point = 0;
        var point1 = 0;

        while(stack.length > 0){
            pixel = stack.pop();

            if(pixel[0] < 0 || pixel[0] >= width)
                continue;
            if(pixel[1] < 0 || pixel[1] >= height)
                continue;

            point = pixel[1] * 4 * width + pixel[0] * 4 + 3;
            point1 = (pixel[1] - dy) * 4 * width + (pixel[0] - dx) * 4 + 3;
            //Si no es un marco y no ha sido pintado
            if(imgdataRand.data[point] != 255 && imgdataRand.data[point] < 1){
                //instalamos lo que ya hemos comprobado
                if(imgdataRand.data[point]==0){
                    imgdataRand.data[point] = 2;
                }
                //Copiar los datos en el lienzo principal
                imageData.data[point1] = imgCopyRandMain.data[point];
                imageData.data[point1 - 1] = imgCopyRandMain.data[point - 1];
                imageData.data[point1 - 2] = imgCopyRandMain.data[point - 2];
                imageData.data[point1 - 3] = imgCopyRandMain.data[point - 3];

                //Poner en la pila para comprobar
                stack.push([
                    pixel[0] - 1,
                    pixel[1]
                ]);
                stack.push([
                    pixel[0] + 1,
                    pixel[1]
                ]);
                stack.push([
                    pixel[0],
                    pixel[1] - 1
                ]);
                stack.push([
                    pixel[0],
                    pixel[1] + 1
                ]);
            }
        }
        ctx.putImageData(imageData, 0,0);
    };

    var onPaint = function(){
        if(tool == 'brush'){
            onPaintBrush();
        } else if(tool == 'circle'){
            onPaintCircle();
        } else if (tool == 'line'){
            onPaintLine();
        } else if (tool == 'rectangle'){
            onPaintRect();
        } else if (tool == 'elipse'){
            drawEllipse(tmpCtx);
        } else if (tool == 'eraser'){
            onErase();
        } else if (tool == 'spray'){
            generateSprayParticles();
        } else if (tool == 'copy'){
            onCopy();
        } else if (tool == 'text'){
            onText();
        } else if (tool == 'fill'){
            onFill(alpha);
        } else if (tool == 'copyrand'){
            oncopyRand();
        } else if (tool == 'no'){

        }
    };

}());



