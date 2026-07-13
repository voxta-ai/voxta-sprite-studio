const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // file selection
    pickImage: () => ipcRenderer.invoke('dialog:pickImage'),
    pickImages: () => ipcRenderer.invoke('dialog:pickImages'),
    pickVideos: () => ipcRenderer.invoke('dialog:pickVideos'),
    readImage: (path) => ipcRenderer.invoke('fs:readImage', path),
    openFolder: (path) => ipcRenderer.invoke('shell:openFolder', path),

    // drag-and-drop: resolve a dropped File to its absolute path
    getPathForFile: (file) => webUtils.getPathForFile(file),

    // step 1: AI background removal
    isBgReady: () => ipcRenderer.invoke('bg:isReady'),
    removeBackground: (data) => ipcRenderer.invoke('bg:remove', data),
    onBgLog: (cb) => {
        const handler = (_e, line) => cb(line);
        ipcRenderer.on('bg:log', handler);
        return () => ipcRenderer.removeListener('bg:log', handler);
    },

    // crop
    saveCrop: (data) => ipcRenderer.invoke('crop:save', data),

    // step 2: composite backdrop
    saveBackdrop: (data) => ipcRenderer.invoke('backdrop:save', data),

    // step 3: video conversion
    convertVideos: (data) => ipcRenderer.invoke('video:convert', data),
    onVideoLog: (cb) => {
        const handler = (_e, line) => cb(line);
        ipcRenderer.on('video:log', handler);
        return () => ipcRenderer.removeListener('video:log', handler);
    },
});
