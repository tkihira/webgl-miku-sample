;(function() {
	var config = {
		objName: "append.obj",
		mtlName: "append.mtl"
	};
	// XHRを使ってOBJファイルを取得する
	var fileCount = 0;
	window.onload = function() {
		var callback = function() {
			fileCount--;
			if(fileCount == 0) {
				// 全ファイルがロードされたら初期化
				initialize();
			}
		};
		loadFile(config.objName, "obj", callback);
		loadFile(config.mtlName, "mtl", callback);
	};
	var files = {};
	var loadFile = function(url, name, callback) {
		fileCount++;
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			if(xhr.readyState == 4) {
				files[name] = xhr.responseText;
				callback();
			}
		};
		xhr.open("GET", url, true);
		xhr.send("");
	};
	
	var gl; // WebGLのcontext
	var prog; // コンパイル・リンクされたプログラム
	var glObj; // WebGL用に変換されたモデルデータ
	var initialize = function() {
		// OBJファイル、MTLファイルをパース
		var obj = objParser.objParse(files.obj);
		var mtl = objParser.mtlParse(files.mtl);
		// パースしたデータを元にWebGL用のObjectを作成する
		objParser.createGLObject(obj, mtl, function(ret) {
			// 全てのテクスチャがロードされたら呼ばれる
			glObj = ret;
			
			// WebGLのcontextを取得
			var canvas = document.getElementById("canvas");
			gl = canvas.getContext("experimental-webgl") || canvas.getContext("webgl");
			if(!gl) {
				document.write("This browser does not support webgl");
				return;
			}
			
			// Vertex Shaderをコンパイル
			var vs = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vs, document.getElementById("vs").text);
			gl.compileShader(vs);
			if(!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
				console.log("vertex shader compile error");
				console.log(gl.getShaderInfoLog(vs));
				return;
			}

			// Fragment Shaderをコンパイル
			var fs = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fs, document.getElementById("fs").text);
			gl.compileShader(fs);
			if(!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
				console.log("fragment shader compile error");
				console.log(gl.getShaderInfoLog(fs));
				return;
			}

			// Shaderをリンク
			prog = gl.createProgram();
			gl.attachShader(prog, vs);
			gl.attachShader(prog, fs);
			gl.linkProgram(prog);
			if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
				console.log("link error");
				console.log(gl.getShaderInfoLog(fs));
				return;
			}
			// リンクしたプログラムの使用を指示
			gl.useProgram(prog);
			loadBuffer();
			drawFrame();
		});
	};
	var vbuf; // 頂点座標バッファ
	var nbuf; // 法線ベクトルバッファ
	var vtbuf; // テクスチャ頂点バッファ
	var textures = {}; // テクスチャ保存用
	var loadBuffer = function() {
		// 頂点座標に関し、バッファを生成してデータを指定
		vbuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
		gl.bufferData(gl.ARRAY_BUFFER, glObj.vertices, gl.STATIC_DRAW);
		// 法線ベクトルに関しても同上。配列長は頂点数3×軸3=9個
		nbuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, nbuf);
		gl.bufferData(gl.ARRAY_BUFFER, glObj.normals, gl.STATIC_DRAW);
		// テクスチャ頂点は、配列長が短いので注意
		vtbuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vtbuf);
		gl.bufferData(gl.ARRAY_BUFFER, glObj.texcoords, gl.STATIC_DRAW);

		// 必要なテクスチャを用意する
		for(var name in imgLoader.images) {
			var img = imgLoader.images[name];
			var tex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, tex); // これから操作するテクスチャを指定する
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // WebGLで画像は上下反転されるので、それを防ぐ
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			textures[name] = tex;
		}
	};
	var frame = 0;
	var drawFrame = function() {
		frame++;
		// frustum行列の生成
		var proj_mat = mat4.create();
		mat4.frustum(proj_mat, -1, 1, -1, 1, 3, 10);
		// 移動回転行列の生成
		var mv_mat = mat4.create();
		mat4.translate(mv_mat, mv_mat, [0, -2, -7]);
		mat4.rotate(mv_mat, mv_mat, frame * 0.01, [0, 1, 0]); // 軸[0, 1, 0]で回転
		// uniformでShaderに送信。4fvはfloat4つの配列（vector）という意味
		gl.uniformMatrix4fv(gl.getUniformLocation(prog, "projectionMatrix"), false, proj_mat);
		gl.uniformMatrix4fv(gl.getUniformLocation(prog, "modelviewMatrix"), false, mv_mat);
		// Canvasの内容をクリア（色は RGB(0, 0, 0, 1): 黒）
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
		// ブレンドモードを設定
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// attributeのindex(position)を取得
		var vpos = gl.getAttribLocation(prog, "vertex");
		var npos = gl.getAttribLocation(prog, "normal");
		var vtpos = gl.getAttribLocation(prog, "texcoord");

		// 取得したattribute positionにバッファを送信
		gl.bindBuffer(gl.ARRAY_BUFFER, vbuf); // 頂点座標
		gl.vertexAttribPointer(vpos, 3, gl.FLOAT, false, 0, 0); // float型を1頂点につき3つ、と指定
		gl.enableVertexAttribArray(vpos);

		gl.bindBuffer(gl.ARRAY_BUFFER, nbuf); // 法線ベクトル
		gl.vertexAttribPointer(npos, 3, gl.FLOAT, true, 0, 0); // float型を1頂点につき3つ、と指定
		gl.enableVertexAttribArray(npos);

		gl.bindBuffer(gl.ARRAY_BUFFER, vtbuf); // テクスチャ座標
		gl.vertexAttribPointer(vtpos, 2, gl.FLOAT, false, 0, 0); // テクスチャ座標は1頂点につき2要素
		gl.enableVertexAttribArray(vtpos);

		// Alpha情報を出力しないように設定
		gl.colorMask(true, true, true, false);
		// 今まで設定した内容でWebGLに送信
		// 一度に送信せず、mtl情報ごとに分割して送信する
		var pos = 0;
		for(var i = 0; i < glObj.mtlInfos.length; i++) {
			var mtlInfo = glObj.mtlInfos[i];

			// Kd, Ks, Nsをそれぞれuniformで送信
			gl.uniform3fv(gl.getUniformLocation(prog, "kdcolor"), mtlInfo.kd);
			gl.uniform3fv(gl.getUniformLocation(prog, "kscolor"), mtlInfo.ks);
			gl.uniform1f(gl.getUniformLocation(prog, "nscolor"), mtlInfo.ns); // 1fの意味はfloat1個

			// テクスチャがあればテクスチャを送信する
			if(mtlInfo.texture) {
				gl.bindTexture(gl.TEXTURE_2D, textures[mtlInfo.texture]);
				gl.uniform1i(gl.getUniformLocation(prog, "texture"), 0);
				gl.uniform1f(gl.getUniformLocation(prog, "hasTexture"), 1);
			} else {
				gl.uniform1f(gl.getUniformLocation(prog, "hasTexture"), 0);
			}
			// 前の最後の頂点(pos / 3)から、今回のmtlで描画する頂点数だけ送る
			gl.drawArrays(gl.TRIANGLES, pos / 3, (mtlInfo.endPos - pos) / 3);
			pos = mtlInfo.endPos;
		}
		// Alpha情報を出力するように設定
		gl.colorMask(true, true, true, true);
		setTimeout(drawFrame, 16);
	};
})();
