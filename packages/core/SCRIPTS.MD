# Available scripts

### module:init

> called from the root with `pnpm core module:init moduleName`

Scaffold a default folder and file structure in `src/internal/moduleName`

```
src
└── internal
    └── moduleName
        ├── data
        │   └── ModuleNameDataSource.ts
        ├── di
        │   ├── moduleNameModule.ts
        │   ├── moduleNameModule.test.ts
        │   └── moduleNameTypes.ts
        ├── model
        │   └── .gitkeep
        ├── service
        │   ├── ModuleNameService.ts
        │   ├── DefaultModuleNameService.test.ts
        │   └── DefaultModuleNameService.test.ts
        └── usecase
            └── .gitkeep
```
