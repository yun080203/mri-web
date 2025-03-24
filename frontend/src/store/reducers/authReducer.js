// 定义action类型
export const AUTH_ACTIONS = {
    LOGIN: 'auth/login',
    LOGOUT: 'auth/logout',
    SET_USER: 'auth/setUser',
    AUTH_ERROR: 'auth/error'
};

// 初始状态
const initialState = {
    isAuthenticated: !!localStorage.getItem('token'),
    user: null,
    error: null,
    loading: false
};

// reducer函数
export default function authReducer(state = initialState, action) {
    switch (action.type) {
        case AUTH_ACTIONS.LOGIN:
            return {
                ...state,
                isAuthenticated: true,
                user: action.payload,
                error: null,
                loading: false
            };
            
        case AUTH_ACTIONS.LOGOUT:
            localStorage.removeItem('token');
            return {
                ...state,
                isAuthenticated: false,
                user: null,
                error: null,
                loading: false
            };
            
        case AUTH_ACTIONS.SET_USER:
            return {
                ...state,
                user: action.payload,
                loading: false
            };
            
        case AUTH_ACTIONS.AUTH_ERROR:
            return {
                ...state,
                error: action.payload,
                loading: false
            };
            
        default:
            return state;
    }
} 