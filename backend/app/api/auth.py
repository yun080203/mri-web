from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from ..models.models import db, User
import logging

logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400
            
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            access_token = create_access_token(identity=user.id)
            return jsonify({
                'access_token': access_token,
                'user': {
                    'id': user.id,
                    'username': user.username
                }
            })
            
        return jsonify({'error': '用户名或密码错误'}), 401
        
    except Exception as e:
        logger.error(f"登录失败: {str(e)}")
        return jsonify({'error': '登录失败，请重试'}), 500

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400
            
        if User.query.filter_by(username=username).first():
            return jsonify({'error': '用户名已存在'}), 400
            
        user = User(
            username=username,
            password_hash=generate_password_hash(password)
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '注册成功'
        }), 201
        
    except Exception as e:
        logger.error(f"注册失败: {str(e)}")
        return jsonify({'error': '注册失败，请重试'}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': '用户不存在'}), 404
            
        return jsonify({
            'id': user.id,
            'username': user.username
        })
        
    except Exception as e:
        logger.error(f"获取用户信息失败: {str(e)}")
        return jsonify({'error': '获取用户信息失败'}), 500 