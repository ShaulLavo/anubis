# View Mode Extensibility Infrastructure

This module provides a comprehensive extensibility infrastructure for adding new view modes to the file system. It implements Requirements 7.1, 7.3, 7.4, and 7.5 from the file view modes specification.

## Core Components

### ViewModeRegistry

The central registry for managing all view modes. It provides:

- **Registration**: Clear interface for adding new view modes
- **Detection**: Automatic detection of available view modes for files
- **Validation**: Ensures view modes are available for specific files
- **Initialization**: Built-in modes are automatically registered

### Hooks

#### useViewModeManager
Provides view mode detection and validation functionality:
```typescript
const manager = useViewModeManager(path, stats)
// manager.availableViewModes() - get all available modes
// manager.supportsMultipleViewModes() - check if file has multiple modes
// manager.getValidatedViewMode(mode) - safely validate a mode
```

#### useViewModeState
Manages view mode-specific state with automatic cleanup:
```typescript
const state = useViewModeState(path, viewMode, stats)
// state.viewModeDefinition() - get current mode definition
// state.isDefaultViewMode() - check if current mode is default
// state.viewModeMetadata() - get display metadata
```

#### useViewModeBehavior
Comprehensive behavior management combining all functionality:
```typescript
const behavior = useViewModeBehavior(path, viewMode, stats)
// behavior.shouldShowViewModeToggle() - UI visibility logic
// behavior.getComponentType() - determine which component to render
// behavior.switchViewMode(newMode) - handle mode switching
// behavior.getTabDisplayInfo() - get tab display information
```

## Adding New View Modes

### Basic Registration

```typescript
import { viewModeRegistry } from './extensibility'

viewModeRegistry.register({
  id: 'preview',
  label: 'Preview',
  icon: 'eye',
  isAvailable: (path) => path.endsWith('.md'),
  isDefault: false
})
```

### Advanced Registration with State Management

```typescript
viewModeRegistry.register({
  id: 'diagram',
  label: 'Diagram',
  icon: 'diagram',
  isAvailable: (path) => path.endsWith('.mermaid'),
  stateHooks: {
    createState: () => ({
      zoomLevel: 1,
      panPosition: { x: 0, y: 0 }
    }),
    cleanup: (state) => {
      // Cleanup any resources
      console.log('Cleaning up diagram state', state)
    }
  }
})
```

## Consistent Behavior Patterns

All view modes follow these consistent patterns:

1. **Availability Detection**: Each mode defines when it's available
2. **Default Behavior**: Editor mode is always available and default
3. **State Management**: Optional state hooks for mode-specific data
4. **Error Handling**: Automatic fallback to editor mode on errors
5. **UI Integration**: Consistent toggle and tab display behavior

## Built-in View Modes

### Editor Mode
- **ID**: `editor`
- **Availability**: Always available
- **Default**: Yes (for most files)
- **Purpose**: Standard text editing

### UI Mode
- **ID**: `ui`
- **Availability**: Settings files (`.system/userSettings.json`, `.system/settings.json`)
- **Default**: No
- **Purpose**: User-friendly settings interface

### Binary Mode
- **ID**: `binary`
- **Availability**: Files detected as binary content
- **Default**: No (binary files default to editor mode per Requirement 4.4)
- **Purpose**: Proper binary file viewing

## Integration Examples

### In Components
```typescript
import { useViewModeBehavior } from '../fs/extensibility'

const FileViewer = (props) => {
  const behavior = useViewModeBehavior(
    () => props.path,
    () => props.viewMode,
    () => props.stats
  )

  return (
    <div>
      {behavior.shouldShowViewModeToggle() && (
        <ViewModeToggle 
          options={behavior.getViewModeOptions()}
          current={props.viewMode}
          onSwitch={behavior.switchViewMode}
        />
      )}
      
      <Switch>
        <Match when={behavior.getComponentType() === 'editor'}>
          <CodeEditor />
        </Match>
        <Match when={behavior.getComponentType() === 'settings-ui'}>
          <SettingsUI />
        </Match>
        <Match when={behavior.getComponentType() === 'binary-viewer'}>
          <BinaryViewer />
        </Match>
      </Switch>
    </div>
  )
}
```

### In Tab Management
```typescript
const tabInfo = behavior.getTabDisplayInfo()
// Use tabInfo.displayName for tab labels
// Use tabInfo.tooltip for hover information
// Use tabInfo.viewModeLabel for mode indicators
```

## Requirements Compliance

- **7.1**: ✅ Clear interface for registering new view modes
- **7.3**: ✅ Extensible through configuration and registration
- **7.4**: ✅ Consistent behavior patterns for all view modes
- **7.5**: ✅ Hooks for view mode-specific state management

## Future Extensions

The infrastructure supports:
- Custom state management per view mode
- Icon and label customization
- Complex availability logic
- Mode-specific cleanup procedures
- Integration with external libraries