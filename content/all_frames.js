/*
 * convert unsupported imagetypes into png
 */
function fileConvert(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      let mimetype = file.type;
      let filename = file.name;

      if (mimetype === 'image/webp' || mimetype === "image/jxl" || mimetype === "image/avif") {
        console.log(`Converting ${mimetype} to png`);

        mimetype = 'image/png';
        filename = `${filename.split('.')[0]}.png`;

        const img = new Image();
        img.onload = () => {
          const cvs = document.createElement('canvas');
          cvs.width = img.naturalWidth;
          cvs.height = img.naturalHeight;

          const ctx = cvs.getContext('2d');
          ctx.drawImage(img, 0, 0);

          cvs.toBlob((blob) => {
            const nFile = new File([blob], filename, { type: mimetype });
            resolve(nFile);
          }, mimetype, 0.9);
        };

        img.src = reader.result;
      } else {
        resolve(file);
      }
    }, false);

    reader.readAsDataURL(file);
  });
}

/*
 * create file list for input element out of individual file
 */
function createFileList(a) {
  // eslint-disable-next-line prefer-rest-params
  a = [].slice.call(Array.isArray(a) ? a : arguments);
  let b = a.length;
  let c = b;
  let d = true;
  while (b-- && d) d = a[b] instanceof File;
  if (!d) throw new TypeError('expected argument to FileList is File or array of File objects');
  for (b = (new ClipboardEvent('')).clipboardData || new DataTransfer(); c--;) b.items.add(a[c]);
  return b.files;
}

/*
 * Show file picker on input field, convert file if needed
 * and return when file is ready
 */
let cancelSelect = null;
function selectFile(input) {
  return new Promise((resolve, reject) => {
    input.addEventListener('change', async (event) => {
      try {
        cancelSelect = null;
        if (input.files.length === 0) {
          reject(new Error('No File selected'));
          return;
        }
        const file = input.files[0];
        const convertedFile = await fileConvert(file);
        input.files = createFileList(convertedFile);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    cancelSelect = () => {
      reject(new Error('File selection cancelled'));
    }

    input.showPicker();
  });
}

window.addEventListener("click", async (event) => {
  let target;

  if (event.target.matches("input[type=file]:not([webkitdirectory])")) {
    target = event.target;
  } else {
    try {
      if (event.originalTarget.matches("input[type=file]:not([webkitdirectory])")) {
        target = event.originalTarget;
      }
    } catch  {
        // permission denied to read "originalTarget" property
    }
  }

  if (target) {
    event.preventDefault();
    handleInputElement(target);
  }
});

// Let the extension work on pages that stop propagation of input events (tinypng.com, etc.)
exportFunction(
  function () {
    this.stopPropagation();

    if (this.type === "click" && this.target.matches("input[type=file]:not([webkitdirectory])")) {
      this.preventDefault();
      handleInputElement(this.target);
    }
  },
  MouseEvent.prototype,
  { defineAs: "stopPropagation" }
);

// Let the extension work on pages with inputs that aren't attached to the page (google.com, etc.)
exportFunction(
  function () {
    if (!this.isConnected && this.matches("[type=file]:not([webkitdirectory])")) {
      handleInputElement(this);
    } else {
      return this.click();
    }
  },
  HTMLInputElement.prototype,
  { defineAs: "click" }
);

// Let the extension work on pages that open the file picker with showPicker
exportFunction(
  function () {
    if (this.matches("[type=file]:not([webkitdirectory])")) {
      handleInputElement(this);
    } else {
      return this.showPicker();
    }
  },
  HTMLInputElement.prototype,
  { defineAs: "showPicker" }
);

// Let the extension work on pages that open the file picker by dispatching an uncancellable click event
exportFunction(
  function (event) {
    if (event.type === "click" && this.matches("[type=file]:not([webkitdirectory])")) {
      handleInputElement(this);
      return true;
    } else {
      return this.dispatchEvent(event);
    }
  },
  HTMLInputElement.prototype,
  { defineAs: "dispatchEvent" }
);

async function handleInputElement(input) {
  if (cancelSelect) {
    cancelSelect();
  }
  const hiddenInput = document.createElement('INPUT');
  hiddenInput.setAttribute('type', 'file');
  try {
    await selectFile(hiddenInput);
  } catch (err) {
    hiddenInput.remove();
    console.log(err.message);
    return;
  }
  console.log("File selected");
  input.files = structuredClone(hiddenInput.files);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
