from functools import wraps
import hashlib
import json
import logging
from datetime import datetime, timedelta
from flask_caching import Cache
from flask import current_app

logger = logging.getLogger(__name__)

cache = Cache()

def init_cache(app):
    """初始化缓存服务"""
    cache_config = {
        'CACHE_TYPE': app.config.get('CACHE_TYPE', 'simple'),
        'CACHE_DEFAULT_TIMEOUT': app.config.get('CACHE_DEFAULT_TIMEOUT', 300),
    }
    
    if app.config.get('CACHE_TYPE') == 'redis':
        cache_config.update({
            'CACHE_REDIS_URL': app.config.get('CACHE_REDIS_URL', 'redis://localhost:6379/0'),
            'CACHE_KEY_PREFIX': app.config.get('CACHE_KEY_PREFIX', 'mri_app:')
        })
    
    cache.init_app(app, config=cache_config)
    logger.info(f"缓存服务已初始化，类型: {cache_config['CACHE_TYPE']}")

def cache_key(*args, **kwargs):
    """生成缓存键"""
    key_parts = [str(arg) for arg in args]
    key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
    key_string = "|".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()

def cached(timeout=300, key_prefix=''):
    """缓存装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            cache_key_string = key_prefix + cache_key(*args, **kwargs)
            
            # 尝试从缓存获取
            rv = cache.get(cache_key_string)
            if rv is not None:
                logger.debug(f"缓存命中: {cache_key_string}")
                return rv
                
            # 执行原函数
            rv = f(*args, **kwargs)
            
            # 存入缓存
            try:
                cache.set(cache_key_string, rv, timeout=timeout)
                logger.debug(f"已缓存: {cache_key_string}, 超时: {timeout}秒")
            except Exception as e:
                logger.error(f"缓存存储失败: {str(e)}")
                
            return rv
        return decorated_function
    return decorator

def cache_patient_data(patient_id, data, timeout=3600):
    """缓存患者数据"""
    key = f"patient:{patient_id}"
    try:
        cache.set(key, data, timeout=timeout)
        logger.info(f"已缓存患者数据: {patient_id}")
        return True
    except Exception as e:
        logger.error(f"缓存患者数据失败: {str(e)}")
        return False

def get_cached_patient_data(patient_id):
    """获取缓存的患者数据"""
    key = f"patient:{patient_id}"
    try:
        data = cache.get(key)
        if data:
            logger.debug(f"从缓存获取患者数据: {patient_id}")
        return data
    except Exception as e:
        logger.error(f"获取缓存患者数据失败: {str(e)}")
        return None

def cache_processing_result(task_id, result, timeout=86400):
    """缓存处理结果"""
    key = f"task_result:{task_id}"
    try:
        cache.set(key, result, timeout=timeout)
        logger.info(f"已缓存处理结果: {task_id}")
        return True
    except Exception as e:
        logger.error(f"缓存处理结果失败: {str(e)}")
        return False

def get_cached_processing_result(task_id):
    """获取缓存的处理结果"""
    key = f"task_result:{task_id}"
    try:
        result = cache.get(key)
        if result:
            logger.debug(f"从缓存获取处理结果: {task_id}")
        return result
    except Exception as e:
        logger.error(f"获取缓存处理结果失败: {str(e)}")
        return None

def clear_patient_cache(patient_id):
    """清除患者相关的所有缓存"""
    try:
        cache.delete(f"patient:{patient_id}")
        logger.info(f"已清除患者缓存: {patient_id}")
        return True
    except Exception as e:
        logger.error(f"清除患者缓存失败: {str(e)}")
        return False

def clear_task_cache(task_id):
    """清除任务相关的所有缓存"""
    try:
        cache.delete(f"task_result:{task_id}")
        logger.info(f"已清除任务缓存: {task_id}")
        return True
    except Exception as e:
        logger.error(f"清除任务缓存失败: {str(e)}")
        return False 