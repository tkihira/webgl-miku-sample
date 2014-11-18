;(function() {
	window.onload = function() {
		initialize();
	};
	
	var gl; // WebGLのcontext
	var prog; // コンパイル・リンクされたプログラム
	var initialize = function() {
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
		gl.useProgram(prog);
		loadBuffer();
		drawFrame();
	};
	var vbuf;
	var nbuf;
	var loadBuffer = function() {
		vbuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0]), gl.STATIC_DRAW);
		nbuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, nbuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), gl.STATIC_DRAW);
	};
	var frame = 0;
	var drawFrame = function() {
		frame++;
		var proj_mat = mat4.create();
		mat4.frustum(proj_mat, -1, 1, -1, 1, 3, 10);
		var mv_mat = mat4.create();
		mat4.translate(mv_mat, mv_mat, [0, 0, -6]);
		mat4.rotate(mv_mat, mv_mat, frame * 0.1, [0, 1, 0]);
		gl.uniformMatrix4fv(gl.getUniformLocation(prog, "projectionMatrix"), false, proj_mat);
		gl.uniformMatrix4fv(gl.getUniformLocation(prog, "modelviewMatrix"), false, mv_mat);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);

		var vpos = gl.getAttribLocation(prog, "vertex");
		var npos = gl.getAttribLocation(prog, "normal");

		gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
		gl.vertexAttribPointer(vpos, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(vpos);

		gl.bindBuffer(gl.ARRAY_BUFFER, nbuf);
		gl.vertexAttribPointer(npos, 3, gl.FLOAT, true, 0, 0);
		gl.enableVertexAttribArray(npos);

		gl.drawArrays(gl.TRIANGLES, 0, 3);
		setTimeout(drawFrame, 16);
	};
})();
