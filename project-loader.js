
      const getBase85DecodeValue = (code) => {
        if (code === 0x28) code = 0x3c;
        if (code === 0x29) code = 0x3e;
        return code - 0x2a;
      };
      const base85decode = (str, outBuffer, outOffset) => {
        const view = new DataView(outBuffer, outOffset, Math.floor(str.length / 5 * 4));
        for (let i = 0, j = 0; i < str.length; i += 5, j += 4) {
          view.setUint32(j, (
            getBase85DecodeValue(str.charCodeAt(i + 4)) * 85 * 85 * 85 * 85 +
            getBase85DecodeValue(str.charCodeAt(i + 3)) * 85 * 85 * 85 +
            getBase85DecodeValue(str.charCodeAt(i + 2)) * 85 * 85 +
            getBase85DecodeValue(str.charCodeAt(i + 1)) * 85 +
            getBase85DecodeValue(str.charCodeAt(i))
          ), true);
        }
      };
      let projectDecodeBuffer = new ArrayBuffer(25028640);
      let projectDecodeIndex = 0;
      const decodeChunk = (data, size) => {
        try {
          base85decode(data, projectDecodeBuffer, projectDecodeIndex);
          projectDecodeIndex += size;
          setProgress(interpolate(0.1, 0.75, projectDecodeIndex / 25028640));
        } catch (e) {
          handleError(e);
        }
      };
      for (const dataFile of window.__projectDataChunks) {
        for (const [data, size] of dataFile) decodeChunk(data, size);
      }
      window.__projectDataChunks = null;
      
      const getProjectData = (function() {
        const storage = scaffolding.storage;
        storage.onprogress = (total, loaded) => {
          setProgress(interpolate(0.75, 0.98, loaded / total));
        };
        
        let zip;
        // Allow zip to be GC'd after project loads
        vm.runtime.on('PROJECT_LOADED', () => (zip = null));
        const findFileInZip = (path) => zip.file(path) || zip.file(new RegExp("^([^/]*/)?" + path + "$"))[0];
        storage.addHelper({
          load: (assetType, assetId, dataFormat) => {
            if (!zip) {
              throw new Error('Zip is not loaded or has been closed');
            }
            const path = assetId + '.' + dataFormat;
            const file = findFileInZip(path);
            if (!file) {
              console.error('Asset is not in zip: ' + path);
              return Promise.resolve(null);
            }
            return file
              .async('uint8array')
              .then((data) => storage.createAsset(assetType, dataFormat, data, assetId));
          }
        });
        return () => (() => {
        const buffer = projectDecodeBuffer;
        projectDecodeBuffer = null; // Allow GC
        return Promise.resolve(new Uint8Array(buffer, 0, 25028640));
      })().then(async (data) => {
          zip = await Scaffolding.JSZip.loadAsync(data);
          const file = findFileInZip('project.json');
          if (!file) {
            throw new Error('project.json is not in zip');
          }
          return file.async('arraybuffer');
        });
      })();
    
    const run = async () => {
      const projectData = await getProjectData();
      await scaffolding.loadProject(projectData);
      setProgress(1);
      loadingScreen.hidden = true;
      if (false) {
        scaffolding.start();
      } else {
        launchScreen.hidden = false;
        launchScreen.addEventListener('click', () => {
          launchScreen.hidden = true;
          scaffolding.start();
        });
        launchScreen.focus();
      }
    };
    run().catch(handleError);
  