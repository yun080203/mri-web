import { combineReducers, createStore } from 'redux';
import authReducer from './reducers/authReducer';
import uploadReducer from './reducers/uploadReducer';
import patientReducer from './reducers/patientReducer';

// 组合所有reducers
const rootReducer = combineReducers({
    auth: authReducer,
    upload: uploadReducer,
    patient: patientReducer
});

// 创建store
const store = createStore(
    rootReducer,
    // 启用Redux DevTools
    window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
);

export default store; 