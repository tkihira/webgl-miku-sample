;var objParser = {};
(function() {
	// MTLファイルのパース
	objParser.mtlParse = function(text) {
		var mtl = {};
		var current = null; // 現在のmtl情報
		// 今まで収集したmtl情報を保存する
		var addCurrent = function() {
			if(current) {
				mtl[current.name] = current;
			}
			current = {};
		};

		var lines = text.split('\n');
		for(var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var words = line.split(' ');
			switch(words[0]) {
				case "newmtl":
					// 新しいmtlの登場
					addCurrent(); // 既存のmtlを保存
					current.name = words[1]; // 新しいmtlの名前を保存
					break;
				case "Kd":
					// 拡散光の保存
					current.kd = vec3.fromValues(+words[1], +words[2], +words[3]);
					break;
				case "Ks":
					// 鏡面光の保存
					current.ks = vec3.fromValues(+words[1], +words[2], +words[3]);
					break;
				case "Ns":
					// 光沢率の保存
					current.ns = +words[1];
					break;
				case "map_Kd":
					// テクスチャの保存
					current.texture = words[1];
					break;
			}
		}
		// ファイルの最後のmtl情報を保存する
		addCurrent();
		return mtl;
	};
	// OBJファイルのパース
	objParser.objParse = function(text) {
		var vertices = []; // 頂点座標
		var normals = []; // 法線ベクトル
		var texcoords = []; // テクスチャ座標
		var faces = []; // ポリゴン定義

		var lines = text.split('\n');
		var mtlName = "";
		for(var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var words = line.split(' ');
			switch(words[0]) {
				default:
					// 理解できない接頭辞の場合は単純に無視する
					break;
				case "usemtl":
					// mtl名が指定された場合は、それをポリゴン定義用に保存する
					mtlName = words[1];
					break;
				case "v":
					// 頂点座標の定義を保存する（x, y, zの3つ）
					vertices.push(+words[1]);
					vertices.push(+words[2]);
					vertices.push(+words[3]);
					break;
				case "vt":
					// テクスチャ座標の定義を保存する（u, vの2つ）
					texcoords.push(+words[1]);
					texcoords.push(+words[2]);
					break;
				case "vn":
					// 法線ベクトルの定義を保存する（x, y, zの3つ）
					normals.push(+words[1]);
					normals.push(+words[2]);
					normals.push(+words[3]);
					break;
				case "f":
					// ポリゴンの定義を保存する
					var face = [];
					for(var wi = 1; wi < words.length; wi++) {
						// 定義は"数値" "数値/数値" "数値//数値" "数値/数値/数値"のどれか
						// 数値はindexの番号（1スタート）
						var nums = (words[wi]+"//").split('/');
						var vindex = +nums[0];
						var tindex = NaN;
						var nindex = NaN;
						if(nums[1].length) {
							tindex = +nums[1];
						}
						if(nums[2].length) {
							nindex = +nums[2];
						}
						// それぞれのindexを、もし存在すればmtl名と共に保存する
						face.push({vindex: vindex, tindex: tindex, nindex: nindex, mtlName: mtlName});
					}
					faces.push(face);
					break;
			}
		}
		return {
			vertices: vertices,
			normals: normals,
			texcoords: texcoords,
			faces: faces
		};
	};

	// OBJファイルとMTLファイルの情報を元にWebGL用のTypedArrayを用意する
	objParser.createGLObject = function(obj, mtl, func) {
		// まずポリゴンの枚数を特定する
		var numTriangles = 0;
		for(var i = 0; i < obj.faces.length; i++) {
			numTriangles += obj.faces[i].length - 2;
		}
		// ポリゴンの枚数に応じたTypedArrayを確保する
		// 頂点座標（ポリゴン数×3頂点×3要素）
		var vertices = new Float32Array(numTriangles * 9);
		// 法線ベクトル（ポリゴン数×3頂点×3要素）
		var normals = new Float32Array(numTriangles * 9);
		// テクスチャ頂点座標（ポリゴン数×3頂点×2要素）
		var texcoords = new Float32Array(numTriangles * 6);

		// 頂点ごとの法線ベクトルの和用配列
		var normalAtVertex = new Array(numTriangles * 3);
		// 頂点ごとの法線ベクトルの計算用関数
		var addNormal = function(index, n) {
			if(!normalAtVertex[index]) {
				// その頂点で初めての登録の場合は、法線ベクトルをただ登録する
				normalAtVertex[index] = vec3.clone(n);
				return;
			} else {
				// すでに登録してあった頂点に追加する場合は、ベクトルの足し算をする
				var normal = normalAtVertex[index];
				vec3.add(normal, normal, n);
			}
		};

		var currentMtlName = ""; // 現在選択されているmtl名
		var mtlInfos = []; // mtl単位の情報
		// 現在のmtl情報の保存
		var saveMtlInfo = function() {
			if(!mtl) {
				// mtlの情報がなかった時には、適当な色情報を用意しておく
				mtlInfos.push({
					endPos: triangleCount * 9,
					kd: vec3.fromValues(0.5, 0.5, 0.5),
					ks: vec3.fromValues(0.0, 0.0, 0.0),
					ns: 1,
					texture: null
				});
			} else if(currentMtlName) {
				var textureName = mtl[currentMtlName].texture;
				if(textureName) {
					// テクスチャが必要であればロードする
					imgLoader.load(textureName, function() {
						if(!imgLoader.isLoading()) {
							func(ret);
						}
					});
				}
				// mtlの情報とポリゴン情報を保存する
				mtlInfos.push({
					endPos: triangleCount * 9,
					kd: mtl[currentMtlName].kd,
					ks: mtl[currentMtlName].ks,
					ns: mtl[currentMtlName].ns,
					texture: textureName
				});
			}
		};
		var triangleCount = 0;
		for(var fi = 0; fi < obj.faces.length; fi++) {
			// objファイルの"f"定義1行ごとに処理する
			var face = obj.faces[fi];
			// mtlが変わった時には、現在までの情報を保存する
			if(currentMtlName != face[0].mtlName) {
				saveMtlInfo();
				currentMtlName = face[0].mtlName;
			}
			// "f"が3つ以上あるときに、頂点は(0, 1, 2), (0, 2, 3), (0, 3, 4), ... という風に処理する
			for(var ti = 1; ti < face.length - 1; ti++) {
				// 三角形の頂点インデックスの取得（1ずれているのに注意）
				var vi0 = face[0].vindex - 1;
				var vi1 = face[ti].vindex - 1;
				var vi2 = face[ti + 1].vindex - 1;
				// インデックスから三角形の頂点座標を取得し、TypedArrayのvec3で保存する
				var v0 = vec3.fromValues(obj.vertices[vi0 * 3], obj.vertices[vi0 * 3 + 1], obj.vertices[vi0 * 3 + 2]);
				var v1 = vec3.fromValues(obj.vertices[vi1 * 3], obj.vertices[vi1 * 3 + 1], obj.vertices[vi1 * 3 + 2]);
				var v2 = vec3.fromValues(obj.vertices[vi2 * 3], obj.vertices[vi2 * 3 + 1], obj.vertices[vi2 * 3 + 2]);
				// 頂点座標をTypedArrayに保存
				vertices.set(v0, triangleCount * 9);
				vertices.set(v1, triangleCount * 9 + 3);
				vertices.set(v2, triangleCount * 9 + 6);
				// テクスチャのインデックスの取得（1ずれているのに注意）
				var vti0 = face[0].tindex - 1;
				var vti1 = face[ti].tindex - 1;
				var vti2 = face[ti + 1].tindex - 1;
				// インデックスからテクスチャ頂点を持ってくる
				var vt0 = vec2.fromValues(obj.texcoords[vti0 * 2], obj.texcoords[vti0 * 2 + 1]);
				var vt1 = vec2.fromValues(obj.texcoords[vti1 * 2], obj.texcoords[vti1 * 2 + 1]);
				var vt2 = vec2.fromValues(obj.texcoords[vti2 * 2], obj.texcoords[vti2 * 2 + 1]);
				// テクスチャ頂点をTypedArrayに保存
				texcoords.set(vt0, triangleCount * 6);
				texcoords.set(vt1, triangleCount * 6 + 2);
				texcoords.set(vt2, triangleCount * 6 + 4);
				// 法線を計算
				var n = vec3.create();
				vec3.sub(v1, v1, v0); // 頂点v0→v1のベクトルを計算
				vec3.sub(v2, v2, v0); // 頂点v0→v2のベクトルを計算
				vec3.cross(n, v1, v2); // 上記2つのベクトルの外積を計算
				// 正規化
				vec3.normalize(n, n);
				// 頂点ごとの法線の平均を取るために保存
				addNormal(vi0, n);
				addNormal(vi1, n);
				addNormal(vi2, n);

				++triangleCount;
			}
		}
		// 最後に今までのmtlを保存しておく
		saveMtlInfo();

		// すべての法線ベクトルを加算し終わった後で、平均法線ベクトルを登録する
		var triangleCount= 0;
		for(var fi = 0; fi < obj.faces.length; fi++) {
			var face = obj.faces[fi];
			for(var ti = 1; ti < face.length - 1; ti++) {
				// 三角形の頂点インデックスの取得（1ずれているのに注意）
				var vi0 = face[0].vindex - 1;
				var vi1 = face[ti].vindex - 1;
				var vi2 = face[ti + 1].vindex - 1;
				// 頂点ごとの法線ベクトルの和を取得
				var n0 = normalAtVertex[vi0];
				var n1 = normalAtVertex[vi1];
				var n2 = normalAtVertex[vi2];
				// 正規化（ベクトルの長さを１にする）
				vec3.normalize(n0, n0);
				vec3.normalize(n1, n1);
				vec3.normalize(n2, n2);
				// 計算し終わった法線ベクトルをTypedArrayに保存
				normals.set(n0, triangleCount * 9);
				normals.set(n1, triangleCount * 9 + 3);
				normals.set(n2, triangleCount * 9 + 6);

				++triangleCount;
			}
		}
		
		// すべてのデータが揃ったらcallback関数を呼び出す
		var ret = {
			vertices: vertices,
			normals: normals,
			texcoords: texcoords,
			mtlInfos: mtlInfos
		};
		if(!imgLoader.isLoading()) {
			func(ret);
		}
	};
})();

