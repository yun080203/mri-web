from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, get_jwt_identity
from ..models.models import db, User
import datetime

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': '请提供用户名和密码'}), 400

        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            # 确保 user.id 转换为字符串
            access_token = create_access_token(
                identity=str(user.id),
                expires_delta=datetime.timedelta(hours=1)
            )
            
            return jsonify({
                'token': access_token,
                'user': {
                    'id': user.id,
                    'username': user.username
                }
            })
        
        return jsonify({'error': '用户名或密码错误'}), 401

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': '请提供用户名和密码'}), 400

        if User.query.filter_by(username=username).first():
            return jsonify({'error': '用户名已存在'}), 400

        user = User(username=username)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '注册成功'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500 