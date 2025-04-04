// 定义action类型
export const PATIENT_ACTIONS = {
    SET_PATIENTS: 'patient/setPatients',
    ADD_PATIENT: 'patient/addPatient',
    UPDATE_PATIENT: 'patient/updatePatient',
    DELETE_PATIENT: 'patient/deletePatient',
    SET_SELECTED_PATIENT: 'patient/setSelectedPatient',
    SET_LOADING: 'patient/setLoading',
    SET_ERROR: 'patient/setError'
};

// 初始状态
const initialState = {
    patients: [],
    selectedPatient: null,
    loading: false,
    error: null
};

// reducer函数
export default function patientReducer(state = initialState, action) {
    switch (action.type) {
        case PATIENT_ACTIONS.SET_PATIENTS:
            return {
                ...state,
                patients: action.payload,
                loading: false,
                error: null
            };
            
        case PATIENT_ACTIONS.ADD_PATIENT:
            return {
                ...state,
                patients: [...state.patients, action.payload],
                loading: false,
                error: null
            };
            
        case PATIENT_ACTIONS.UPDATE_PATIENT:
            return {
                ...state,
                patients: state.patients.map(patient =>
                    patient.id === action.payload.id ? action.payload : patient
                ),
                selectedPatient: state.selectedPatient?.id === action.payload.id
                    ? action.payload
                    : state.selectedPatient,
                loading: false,
                error: null
            };
            
        case PATIENT_ACTIONS.DELETE_PATIENT:
            return {
                ...state,
                patients: state.patients.filter(patient => patient.id !== action.payload),
                selectedPatient: state.selectedPatient?.id === action.payload
                    ? null
                    : state.selectedPatient,
                loading: false,
                error: null
            };
            
        case PATIENT_ACTIONS.SET_SELECTED_PATIENT:
            return {
                ...state,
                selectedPatient: action.payload
            };
            
        case PATIENT_ACTIONS.SET_LOADING:
            return {
                ...state,
                loading: action.payload
            };
            
        case PATIENT_ACTIONS.SET_ERROR:
            return {
                ...state,
                error: action.payload,
                loading: false
            };
            
        default:
            return state;
    }
} 