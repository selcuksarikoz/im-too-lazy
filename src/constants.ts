export const COMMANDS = {
  quickActionsMenu: 'im-too-lazy.quickActionsMenu',
  pasteToMenu: 'im-too-lazy.pasteToMenu',
  jsonConvertMenu: 'im-too-lazy.jsonConvertMenu',
  jsonToGo: 'im-too-lazy.jsonToGo',
  jsonToTypeScript: 'im-too-lazy.jsonToTypeScript',
  jsonToTypeScriptZod: 'im-too-lazy.jsonToTypeScriptZod',
  jsonToRust: 'im-too-lazy.jsonToRust',
  jsonToPythonPydantic: 'im-too-lazy.jsonToPythonPydantic',
  jsonToPythonDataclass: 'im-too-lazy.jsonToPythonDataclass',
  jsonToPythonTypedDict: 'im-too-lazy.jsonToPythonTypedDict',
  goTagMenuCurrent: 'im-too-lazy.goTagMenuCurrent',
  goTagMenuAll: 'im-too-lazy.goTagMenuAll',
  goTagCurrentJsonBson: 'im-too-lazy.goTagCurrentJsonBson',
  goTagCurrentAll: 'im-too-lazy.goTagCurrentAll',
  goTagAllJsonBson: 'im-too-lazy.goTagAllJsonBson',
  goTagAllAll: 'im-too-lazy.goTagAllAll',
  pythonPropsMenuCurrent: 'im-too-lazy.pythonPropsMenuCurrent',
  pythonPropsMenuClass: 'im-too-lazy.pythonPropsMenuClass',
  pythonPropsMenuAll: 'im-too-lazy.pythonPropsMenuAll',
  uvInitPythonProject: 'im-too-lazy.uvInitPythonProject',
  configurePythonVenvSettings: 'im-too-lazy.configurePythonVenvSettings',
  setupPythonWithUv: 'im-too-lazy.setupPythonWithUv',
  createEditorConfig: 'im-too-lazy.createEditorConfig',
  createPrettierConfig: 'im-too-lazy.createPrettierConfig',
  createFormattingFiles: 'im-too-lazy.createFormattingFiles'
} as const;

export const GO_TAGS = {
  jsonValidateRequired: ['json_omitempty_required'],
  jsonBson: ['json', 'bson'],
  db: ['db'],
  jsonBsonValidateRequired: ['json', 'bson', 'validate_required'],
  all: ['json', 'bson', 'gorm', 'form', 'xorm', 'yaml', 'toml', 'xml', 'mapstructure', 'query', 'db', 'validate_smart', 'binding_required']
} as const;
